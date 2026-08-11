return {
  {
    "mfussenegger/nvim-lint",
    opts = function(_, opts)
      opts.linters_by_ft = opts.linters_by_ft or {}

      -- Disable markdownlint (and any other nvim-lint linters) for Markdown/MDX.
      opts.linters_by_ft.markdown = nil
      opts.linters_by_ft.mdx = nil
      opts.linters_by_ft["markdown.mdx"] = nil
    end,
  },
}
