return {
  "nvim-telescope/telescope.nvim",
  keys = {
    { "<leader><space>", LazyVim.pick("auto", { root = false }), desc = "Find Files (cwd)" },
    { "<leader>/", LazyVim.pick("live_grep", { root = false }), desc = "Grep (cwd)" },
    { "<leader>sg", LazyVim.pick("live_grep", { root = false }), desc = "Grep (cwd)" },
    { "<leader>sG", LazyVim.pick("live_grep"), desc = "Grep (Root Dir)" },
    { "<leader>sw", LazyVim.pick("grep_string", { word_match = "-w", root = false }), desc = "Word (cwd)" },
    { "<leader>sW", LazyVim.pick("grep_string", { word_match = "-w", root = true }), desc = "Word (Root Dir)" },
    { "<leader>sw", LazyVim.pick("grep_string", { root = false }), mode = "v", desc = "Selection (cwd)" },
    { "<leader>sW", LazyVim.pick("grep_string", { root = true }), mode = "v", desc = "Selection (Root Dir)" },
  },
}
