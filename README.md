Dotfiles
========

Brian's dotfiles managed with [Dotbot][dotbot]. Make your own with the [template repo][template].

In general, you should be using symbolic links for everything, and using git
submodules whenever possible.

To keep submodules at their proper versions, you could include something like
`git submodule update --init --recursive` in your `install.conf.yaml`.

To upgrade your submodules to their latest versions, you could periodically run
`git submodule update --init --remote`.

[dotbot]: https://github.com/anishathalye/dotbot
[template]: https://github.com/anishathalye/dotfiles_template/generate

### Install things not managed by this repo:

- oh-my-zsh https://ohmyz.sh/
- espanso https://espanso.org/
- homebrew https://brew.sh/
- spf13 http://vim.spf13.com/
- asciinema
- ngrok
- pass


