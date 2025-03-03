return {
  "akinsho/git-conflict.nvim",
  lazy = false,
  opts = {
    default_mappings = {
      ours = "<leader>ht",
      theirs = "<leader>hb",
      none = "<leader>h0",
      both = "<leader>ha",
      next = "]x",
      prev = "[x",
    },
  },
  keys = {
    { "<leader>gx", "<cmd>GitConflictListQf<cr>", desc = "List Conflicts" },
    { "<leader>gr", "<cmd>GitConflictRefresh<cr>", desc = "Refresh Conflicts" },
  },
}
