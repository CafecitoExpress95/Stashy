set shell := ["powershell.exe", "-NoLogo", "-Command"]

default:
    just --list

# =========================================================
# DEV
# =========================================================

dev:
    npm run dev

preview:
    npm run preview

tauri-dev:
    .\scripts\tauri-dev.cmd

code:
    code .

dev-open:
    Start-Process "http://localhost:5173"
    npm run dev

# =========================================================
# PACKAGE MANAGEMENT
# =========================================================

install package="" flags="":
    if ("{{package}}" -eq "") { npm install {{flags}} } else { npm install {{package}} {{flags}} }

add package:
    npm install {{package}}

add-dev package:
    npm install -D {{package}}

remove package:
    npm uninstall {{package}}

update:
    npm update

fresh:
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
    Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
    npm install

# =========================================================
# CLEAN / RESET
# =========================================================

clean:
    Remove-Item -Recurse -Force .svelte-kit, build, .output -ErrorAction SilentlyContinue

reset:
    Remove-Item -Recurse -Force node_modules, .svelte-kit, build, .output -ErrorAction SilentlyContinue
    npm install

rebuild:
    Remove-Item -Recurse -Force .svelte-kit -ErrorAction SilentlyContinue
    npm run build

# =========================================================
# BUILD / DEPLOY
# =========================================================

build:
    npm run build

verify:
    npm run verify

# =========================================================
# DAILY GIT
# =========================================================

status:
    git status

pull:
    git pull --rebase

push:
    $branch = git branch --show-current; git fetch origin; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; git show-ref --verify --quiet "refs/remotes/origin/$branch"; if ($LASTEXITCODE -eq 0) { git rebase "origin/$branch"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }; git push -u origin HEAD

save msg:
    git add .
    git commit -m "{{msg}}"
    just push

checkpoint:
    git add .
    git commit -m "Checkpoint"
    just push

# Backward compatibility
gac msg:
    just save "{{msg}}"

undo-last:
    git reset --soft HEAD~1

undo-hard:
    git reset --hard HEAD~1

# =========================================================
# FEATURE FLOW
# =========================================================

start name:
    git checkout main
    git pull origin main
    git checkout -b feature/{{name}}

finish:
    $branch = git branch --show-current; if ($branch -eq "main") { Write-Error "Already on main."; exit 1 }; git checkout main; git pull origin main; git merge $branch; git push origin main; git branch -d $branch

sync:
    git fetch origin
    git merge origin/main

rebase:
    git fetch origin
    git rebase origin/main

branches:
    git branch

delete-branch name:
    git branch -d {{name}}

# =========================================================
# UTILITIES
# =========================================================

list:
    just --list

pwd:
    Get-Location

open:
    explorer .

serve-docs:
    npx serve docs

kill-node:
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# =========================================================
# PROJECT SHORTCUTS
# =========================================================

packy:
    code .\packy

localdeck:
    code .\localdeck

prefy:
    code .\prefy
