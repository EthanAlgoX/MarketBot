#!/usr/bin/env bash
set -euo pipefail

root=""
repo=""
author=""
period="daily"
since=""
with_repo=0
group_by_repo=0
all=1
normalize=1
summary_source="subject"

usage() {
  cat <<'USAGE'
Usage: git_today_commits.sh [--root <path>] [--repo <path>] [--author "Name"]
                            [--period daily|weekly] [--since "expr"] [--with-repo]
                            [--group-by-repo] [--no-all] [--no-normalize]
                            [--summary-source subject|diff|both]

Print commit subjects by author across repos (defaults to git config --global user.name).
Only directories containing a .git folder or file are treated as repos; non-git dirs are ignored.
If --root is omitted, WORK_REPORT_ROOT or CODEX_WORK_ROOT will be used if set.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --root)
      root="$2"
      shift 2
      ;;
    --repo)
      repo="$2"
      shift 2
      ;;
    --author)
      author="$2"
      shift 2
      ;;
    --period)
      period="$2"
      shift 2
      ;;
    --since)
      since="$2"
      shift 2
      ;;
    --with-repo)
      with_repo=1
      shift 1
      ;;
    --group-by-repo)
      group_by_repo=1
      shift 1
      ;;
    --no-all)
      all=0
      shift 1
      ;;
    --no-normalize)
      normalize=0
      shift 1
      ;;
    --summary-source)
      summary_source="$2"
      shift 2
      ;;
    --normalize)
      normalize=1
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$since" ]; then
  case "$period" in
    daily) since="midnight" ;;
    weekly)
      if date -v-0d +%Y-%m-%d >/dev/null 2>&1; then
        dow=$(date +%u)
        offset=$((dow - 1))
        since=$(date -v-"${offset}"d +%Y-%m-%d)
      else
        dow=$(date +%u)
        offset=$((dow - 1))
        since=$(date -d "-${offset} day" +%Y-%m-%d)
      fi
      since="${since} 00:00"
      ;;
    *)
      echo "Unknown period: $period" >&2
      exit 1
      ;;
  esac
fi

repos=()
if [ -n "$repo" ]; then
  repos=("$repo")
else
  if [ -z "$root" ]; then
    if [ -n "${WORK_REPORT_ROOT:-}" ]; then
      root="$WORK_REPORT_ROOT"
    elif [ -n "${CODEX_WORK_ROOT:-}" ]; then
      root="$CODEX_WORK_ROOT"
    fi
  fi
  if [ -z "$root" ]; then
    echo "Missing --root (or use --repo, or set WORK_REPORT_ROOT/CODEX_WORK_ROOT)." >&2
    exit 1
  fi
  if [ ! -d "$root" ]; then
    echo "Root path not found: $root" >&2
    exit 1
  fi
  while IFS= read -r -d '' gitpath; do
    repos+=("$(dirname "$gitpath")")
  done < <(find "$root" \( -name .git -type d -prune -print0 \) -o \( -name .git -type f -print0 \))
fi

if [ ${#repos[@]} -eq 0 ]; then
  echo "No git repos found under: $root" >&2
  exit 1
fi

if [ -z "$author" ]; then
  author=$(git config --global user.name || true)
  if [ -z "$author" ]; then
    author=$(git config --global user.email || true)
  fi
fi

if [ -z "$author" ]; then
  first_repo="${repos[0]}"
  author=$(git -C "$first_repo" config user.name || true)
  if [ -z "$author" ]; then
    author=$(git -C "$first_repo" config user.email || true)
  fi
fi

normalize_line() {
  local line="$1"
  local cleaned=""
  local lower=""

  cleaned=$(printf '%s' "$line" | sed -E 's/^[[:space:]]*([a-zA-Z]+)(\([^)]+\))?(!)?:[[:space:]]*//; s/^[[:space:]]*\\[[^]]+\\][[:space:]]*//')
  if [ -z "$cleaned" ]; then
    return 0
  fi

  lower=$(printf '%s' "$cleaned" | tr '[:upper:]' '[:lower:]')
  case "$lower" in
    *"冲突"*|*"合并"*|*"merge"*|*"rebase"*|*"cherry-pick"*|*"conflict"*)
      printf '%s\n' "代码集成与稳定性维护"
      return 0
      ;;
    *"format"*|*"lint"*|*"ci"*|*"pipeline"*|*"workflow"*|*"格式化"*|*"规范"*)
      printf '%s\n' "工程化与代码质量维护"
      return 0
      ;;
    *"deps"*|*"dependency"*|*"bump"*|*"upgrade"*|*"依赖"*)
      printf '%s\n' "依赖升级与安全维护"
      return 0
      ;;
    *"refactor"*|*"重构"*)
      printf '%s\n' "代码结构优化"
      return 0
      ;;
    *"test"*|*"测试"*)
      printf '%s\n' "测试完善与稳定性提升"
      return 0
      ;;
    *"docs"*|*"readme"*|*"changelog"*|*"文档"*)
      printf '%s\n' "文档更新与说明完善"
      return 0
      ;;
    *"config"*|*"build"*|*"构建"*|*"配置"*)
      printf '%s\n' "构建配置优化"
      return 0
      ;;
  esac

  cleaned=$(printf '%s' "$cleaned" | sed -E \
    -e 's/^[Aa]dd(ing)? /新增/; s/^[Ff]ix(ing)? /修复/; s/^[Uu]pdate(d|ing)? /更新/; s/^[Rr]emove(d|ing)? /移除/; s/^[Ii]mprove(d|ment)? /优化/; s/^[Ss]upport(ed|ing)? /支持/')

  printf '%s\n' "$cleaned"
}

summarize_commit_diff() {
  local repo_path="$1"
  local commit_hash="$2"
  local status_lines=""
  local add=0
  local mod=0
  local del=0
  local module_list=""
  local module_summary=""
  local stats=()
  local result_parts=()

  status_lines=$(git -C "$repo_path" show --name-status --pretty=format: "$commit_hash" 2>/dev/null)
  if [ -z "$status_lines" ]; then
    return 0
  fi

  read -r add mod del <<< "$(
    printf '%s\n' "$status_lines" | awk '
      BEGIN { add=0; mod=0; del=0; }
      {
        status=$1;
        if (status == "A") add++;
        else if (status == "D") del++;
        else if (status == "M") mod++;
        else if (status ~ /^R/ || status ~ /^C/) mod++;
        else mod++;
      }
      END { printf "%d %d %d", add, mod, del; }
    '
  )"

  module_list=$(
    printf '%s\n' "$status_lines" | awk '
      {
        status=$1;
        path=$2;
        if (status ~ /^R/ || status ~ /^C/) path=$3;
        if (path != "") {
          split(path, parts, "/");
          modules[parts[1]]++;
        }
      }
      END {
        for (m in modules) {
          print modules[m] "\t" m;
        }
      }
    ' | sort -rn | head -n 3 | awk '{print $2}'
  )

  if [ -n "$module_list" ]; then
    module_summary=$(printf '%s\n' "$module_list" | paste -sd '、' -)
  fi

  if [ "$add" -gt 0 ]; then
    stats+=("新增${add}个文件")
  fi
  if [ "$mod" -gt 0 ]; then
    stats+=("修改${mod}个文件")
  fi
  if [ "$del" -gt 0 ]; then
    stats+=("删除${del}个文件")
  fi

  if [ -n "$module_summary" ]; then
    result_parts+=("涉及${module_summary}")
  fi
  if [ ${#stats[@]} -gt 0 ]; then
    result_parts+=("$(IFS='，'; echo "${stats[*]}")")
  fi

  if [ ${#result_parts[@]} -eq 0 ]; then
    return 0
  fi

  printf '%s\n' "$(IFS='，'; echo "${result_parts[*]}")"
}

for repo_path in "${repos[@]}"; do
  if ! git -C "$repo_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Not a git repo: $repo_path" >&2
    continue
  fi
  if ! git -C "$repo_path" rev-parse --verify HEAD >/dev/null 2>&1; then
    continue
  fi

  all_flag=""
  if [ "$all" -eq 1 ]; then
    all_flag="--all"
  fi

  if [ -n "$author" ]; then
    commits=$(git -C "$repo_path" log $all_flag --since="$since" --author="$author" --pretty=format:%H%x09%s)
  else
    commits=$(git -C "$repo_path" log $all_flag --since="$since" --pretty=format:%H%x09%s)
  fi

  if [ -z "$commits" ]; then
    continue
  fi

  if [ "$group_by_repo" -eq 1 ]; then
    printf '%s\n' "$(basename "$repo_path")"
    printf '%s\n' "$commits" | while IFS= read -r line; do
      if [ -z "$line" ]; then
        continue
      fi
      IFS=$'\t' read -r commit_hash commit_subject <<< "$line"
      output_line=""
      case "$summary_source" in
        subject)
          output_line="$commit_subject"
          if [ "$normalize" -eq 1 ]; then
            output_line=$(normalize_line "$output_line")
          fi
          ;;
        diff)
          output_line=$(summarize_commit_diff "$repo_path" "$commit_hash")
          if [ -z "$output_line" ]; then
            output_line="$commit_subject"
            if [ "$normalize" -eq 1 ]; then
              output_line=$(normalize_line "$output_line")
            fi
          fi
          ;;
        both)
          output_line="$commit_subject"
          if [ "$normalize" -eq 1 ]; then
            output_line=$(normalize_line "$output_line")
          fi
          diff_summary=$(summarize_commit_diff "$repo_path" "$commit_hash")
          if [ -n "$diff_summary" ]; then
            output_line="${output_line}（${diff_summary}）"
          fi
          ;;
        *)
          echo "Unknown summary source: $summary_source" >&2
          exit 1
          ;;
      esac
      if [ -n "$output_line" ]; then
        printf '%s\n' "- $output_line"
      fi
    done
    continue
  fi

  printf '%s\n' "$commits" | while IFS= read -r line; do
    if [ -z "$line" ]; then
      continue
    fi
    IFS=$'\t' read -r commit_hash commit_subject <<< "$line"
    output_line=""
    case "$summary_source" in
      subject)
        output_line="$commit_subject"
        if [ "$normalize" -eq 1 ]; then
          output_line=$(normalize_line "$output_line")
        fi
        ;;
      diff)
        output_line=$(summarize_commit_diff "$repo_path" "$commit_hash")
        if [ -z "$output_line" ]; then
          output_line="$commit_subject"
          if [ "$normalize" -eq 1 ]; then
            output_line=$(normalize_line "$output_line")
          fi
        fi
        ;;
      both)
        output_line="$commit_subject"
        if [ "$normalize" -eq 1 ]; then
          output_line=$(normalize_line "$output_line")
        fi
        diff_summary=$(summarize_commit_diff "$repo_path" "$commit_hash")
        if [ -n "$diff_summary" ]; then
          output_line="${output_line}（${diff_summary}）"
        fi
        ;;
      *)
        echo "Unknown summary source: $summary_source" >&2
        exit 1
        ;;
    esac
    if [ -z "$output_line" ]; then
      continue
    fi
    if [ "$with_repo" -eq 1 ]; then
      printf '[%s] %s\n' "$(basename "$repo_path")" "$output_line"
    else
      printf '%s\n' "$output_line"
    fi
  done
done
