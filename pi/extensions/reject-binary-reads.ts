/**
 * Reject Binary Reads Extension
 *
 * Blocks `read` tool calls against binary files (video, audio, archives,
 * documents, executables, etc.) before their raw bytes get slurped into the
 * context window. Suggests a file-appropriate tool instead.
 *
 * Exception: image files (jpg/png/gif/webp/bmp) are allowed through when the
 * active model supports image input, since pi's built-in `read` tool sends
 * those as proper image attachments rather than raw text.
 */

import { open } from "node:fs/promises";
import { extname, isAbsolute, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);

// Extension -> human suggestion for what to use instead of `read`.
const SUGGESTIONS: Array<{ exts: string[]; advice: string }> = [
	{
		exts: [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".flv"],
		advice:
			"This is a video file. Use `ffprobe` to inspect metadata (e.g. `ffprobe -v quiet -print_format json -show_format -show_streams <path>`), or extract frames/audio with `ffmpeg` for further analysis.",
	},
	{
		exts: [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".wma"],
		advice:
			"This is an audio file. Use `ffprobe` for metadata, or a transcription tool (see the transcribe skill) to get text content.",
	},
	{
		exts: [".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar", ".tgz"],
		advice:
			"This is an archive. List or extract its contents first (e.g. `unzip -l <path>` or `tar -tvf <path>`), then read the extracted files individually.",
	},
	{
		exts: [".pdf"],
		advice:
			"This is a PDF. Extract text first with a tool like `pdftotext` or the summarize skill (`uvx markitdown`) instead of reading raw bytes.",
	},
	{
		exts: [".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".ods", ".odp"],
		advice:
			"This is an office document. Convert it to text/markdown first (e.g. `uvx markitdown`, `pandoc`) instead of reading raw bytes.",
	},
	{
		exts: [".exe", ".dll", ".so", ".dylib", ".bin", ".wasm", ".o", ".a", ".class"],
		advice:
			"This is an executable/binary artifact. Use `file <path>` to identify it and `strings`/`hexdump`/`xxd` to inspect it instead of reading raw bytes.",
	},
	{
		exts: [".db", ".sqlite", ".sqlite3"],
		advice:
			"This is a database file. Use the appropriate DB client (e.g. `sqlite3 <path> '.tables'`) to query its contents instead of reading the raw file.",
	},
	{
		exts: [".ttf", ".otf", ".woff", ".woff2"],
		advice: "This is a font file. Use `fc-scan`/`fonttools` or similar to inspect it instead of reading raw bytes.",
	},
	{
		exts: [".iso", ".dmg"],
		advice: "This is a disk image. Mount or extract it with an appropriate tool instead of reading raw bytes.",
	},
];

function findAdvice(ext: string): string | undefined {
	for (const { exts, advice } of SUGGESTIONS) {
		if (exts.includes(ext)) return advice;
	}
	return undefined;
}

/** Sniff a buffer for binary content using a null-byte heuristic (same idea git/ripgrep use). */
function looksBinary(buf: Buffer): boolean {
	const len = Math.min(buf.length, 8192);
	for (let i = 0; i < len; i++) {
		if (buf[i] === 0) return true;
	}
	return false;
}

async function readHead(path: string, bytes: number): Promise<Buffer | undefined> {
	let fh: Awaited<ReturnType<typeof open>> | undefined;
	try {
		fh = await open(path, "r");
		const buf = Buffer.alloc(bytes);
		const { bytesRead } = await fh.read(buf, 0, bytes, 0);
		return buf.subarray(0, bytesRead);
	} catch {
		return undefined;
	} finally {
		await fh?.close().catch(() => {});
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "read") return undefined;

		const rawPath = (event.input as { path?: string }).path;
		if (!rawPath) return undefined;

		const cleanPath = rawPath.startsWith("@") ? rawPath.slice(1) : rawPath;
		const absolutePath = isAbsolute(cleanPath) ? cleanPath : resolve(ctx.cwd, cleanPath);
		const ext = extname(absolutePath).toLowerCase();

		const head = await readHead(absolutePath, 8192);
		if (!head) return undefined; // Let the read tool surface its own not-found/permission error.

		const isImageExt = IMAGE_EXTENSIONS.has(ext);
		const isBinary = looksBinary(head);

		if (!isBinary && !isImageExt) return undefined;

		if (isImageExt) {
			const modelSupportsImages = ctx.model?.input?.includes("image") ?? false;
			if (modelSupportsImages) return undefined; // Built-in read sends this as a proper attachment.

			return {
				block: true,
				reason:
					`Refusing to read image file "${cleanPath}": the active model does not support image input. ` +
					"Switch to a vision-capable model to view it, or use an image analysis/OCR tool instead of reading raw bytes.",
			};
		}

		const advice = findAdvice(ext) ?? `Use \`file ${cleanPath}\` to identify the format, then a file-appropriate tool to extract its content.`;

		return {
			block: true,
			reason: `Refusing to read binary file "${cleanPath}" into context. ${advice}`,
		};
	});
}
