# Git Workspace Manager for Stream Deck

## Goal

Develop a production-ready Stream Deck plugin called **Git Workspace Manager** using the VSDinside Plugin SDK.

SDK to use:
https://github.com/VSDinside/VSDinside-Plugin-SDK

The plugin must be designed around the concept of **one button = one local Git repository**.

The plugin is NOT GitHub-specific.

It must work with any Git remote:

- GitHub
- GitLab
- Azure DevOps
- Bitbucket
- Gitea
- Forgejo
- generic git remotes

Everything should be based on the local git repository.

---

# Philosophy

This plugin should never try to replace SourceTree, GitKraken or an IDE.

Instead, it should become the fastest way to:

- know which repositories need attention
- synchronize repositories
- execute the most common Git actions

The user should rarely need to leave the Stream Deck.

---

# Technical Requirements

Language:
TypeScript

Architecture:

- clean architecture
- strongly typed
- modular
- testable
- SOLID
- dependency injection where appropriate

Separate modules:

- GitService
- RepositoryWatcher
- StreamDeckAction
- PropertyInspector
- SettingsStorage
- ImageRenderer
- SceneNavigator

---

# Repository Configuration

Each Stream Deck key represents ONE local repository.

Configuration:

- Local repository path
- Friendly name (optional)
- Optional custom icon
- Refresh interval (default 60 seconds)
- Default pull strategy
    - merge
    - rebase

---

# Background Monitoring

Every configured repository should be refreshed periodically.

The refresh cycle must execute:

git fetch --quiet

This updates remote references WITHOUT modifying the working tree.

After fetch, compute:

Current branch

Ahead count

Behind count

Working tree dirty

Detached HEAD

Merge in progress

Rebase in progress

Cherry-pick in progress

No upstream branch

Repository not found

Git executable not found

Authentication error

Network error

All states must be cached.

Avoid unnecessary Git executions.

---

# Git Information

Retrieve using git CLI.

Current branch

Ahead count

Behind count

Dirty state

Number of modified files

Current upstream

Repository name

Remote URL

---

# Main Button UI

The main key should always display:

Repository name

Branch

Ahead / Behind

Examples

Synced

Backend

main

↑0 ↓0

----------------

Needs pull

Backend

develop

↑0 ↓5

----------------

Needs push

Backend

feature/login

↑3 ↓0

----------------

Both

Backend

feature/api

↑2 ↓6

----------------

Dirty

Backend

feature/auth

● Dirty

↑1 ↓0

Use colors:

Green

Synced

Blue

Commits to push

Yellow

Commits to pull

Orange

Dirty

Red

Errors

Gray

Detached HEAD

---

# Key Press Behavior

Pressing the repository key MUST navigate to a dedicated Stream Deck page.

DO NOT open:

- terminal
- browser
- popup windows
- desktop dialogs

Everything must stay inside Stream Deck.

---

# Repository Scene

The repository scene should contain actions like:

Fetch

Pull

Push

Sync

Status

Log

Open Repository Folder

Back

Layout example

[ Fetch ]
[ Pull ]

[ Push ]
[ Sync ]

[ Status ]
[ Log ]

[ Folder ]
[ Back ]

---

# Actions

## Fetch

Execute

git fetch --quiet

Return to scene.

Refresh repository state.

---

## Pull

Respect configured strategy.

Merge

git pull

or

Rebase

git pull --rebase

---

## Push

Execute

git push

Refresh state afterwards.

---

## Sync

This is the primary action.

Algorithm

git fetch --quiet

if behind > 0

    git pull (or pull --rebase)

if ahead > 0

    git push

Refresh repository

Return success or failure.

The user should be able to synchronize a repository with ONE key press.

---

## Status

Display:

Current branch

Ahead

Behind

Modified files

Staged files

Conflicts

Operation in progress

This can be another Stream Deck page.

Do not use desktop windows.

---

## Log

Show the latest commits.

Display:

short hash

author

message

date

Navigation:

Previous

Next

Back

---

# Image Rendering

Images should be dynamically generated.

No static assets for every state.

Render:

background color

repository name

branch

icons

ahead/behind

status badges

Support:

light theme

dark theme

high DPI

---

# Error Handling

Handle gracefully:

Repository deleted

Git missing

Remote unreachable

Authentication failed

Merge conflicts

Detached HEAD

Timeout

Corrupted repository

Errors should never crash the plugin.

---

# Property Inspector

The inspector must allow:

Repository folder selection

Refresh interval

Pull strategy

Friendly name

Custom icon

Auto-fetch enable/disable

Auto-return after action

---

# Performance

Never block the UI.

Git operations must run asynchronously.

Support at least:

50 repositories

with refresh every minute.

---

# Logging

Structured logs.

Debug mode.

Verbose mode.

---

# Future Architecture

Design now for future extensions:

GitHub API

GitLab API

CI status

Pull Requests

Issues

Build status

Notifications

without changing the core architecture.

The Git layer must remain completely independent from GitHub.

---

# Code Quality

No duplicated code.

No business logic inside UI.

No global state.

Use interfaces.

Document every public class.

Produce production-quality code.
