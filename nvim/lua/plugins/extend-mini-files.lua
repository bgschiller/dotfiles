return {
  "echasnovski/mini.files",
  keys = {
    {
      "<leader>E",
      function()
        require("mini.files").open(vim.loop.cwd(), false)
      end,
      desc = "Open mini.files (cwd)",
    },
    {
      "<leader>e",
      function()
        require("mini.files").open(vim.api.nvim_buf_get_name(0), false)
      end,
      desc = "Open mini.files (directory of current file)",
    },
  },
}
