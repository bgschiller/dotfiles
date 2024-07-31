local wezterm = require("wezterm")

local config = wezterm.config_builder()

config.default_prog = { "powershell.exe" }
config.font = wezterm.font("FiraCode Nerd Font Mono")

return config
