Set-PSReadLineOption -EditMode Emacs
$global:DefaultUser = [System.Environment]::UserName
oh-my-posh init pwsh --config ~\dotfiles\oh-my-posh.omp.toml | Invoke-Expression
