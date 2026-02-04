-- Configure ESLint to use legacy .eslintrc config format (not flat config)
-- This is needed for projects using ESLint 9+ with legacy config files
return {
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        eslint = {
          settings = {
            useFlatConfig = false,
          },
        },
      },
    },
  },
}
