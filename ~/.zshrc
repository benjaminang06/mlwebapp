# ... existing prompt setup ...
COLOR_GIT='%F{39}'
NEWLINE=$'\n'
setopt PROMPT_SUBST
export PROMPT='${COLOR_USR}%n@%M ${COLOR_DIR}%d ${COLOR_GIT}$(parse_git_branch)${COLOR_DEF}${NEWLINE}%% '
export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"

# ... rest of the file (pyenv setup, etc.) ...