-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

vim.keymap.set("n", "<leader>uc", function()
  require("copilot.suggestion").toggle_auto_trigger()
end)

vim.keymap.set("n", "\\", "<C-w>", { desc = "Show Window menu", remap = true })

vim.keymap.set({ "n", "v", "i" }, "<C-s>", function()
  vim.cmd("write")
end, { desc = "Save file or toggle markdown preview" })
