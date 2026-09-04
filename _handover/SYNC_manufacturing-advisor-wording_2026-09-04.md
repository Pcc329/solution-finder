# SYNC: AI 顧問頁面 Wording 調整

Date: 2026-09-04

## Scope

Changed only user-facing text in `public/manufacturing.html`. No API, layout, interaction, script-tag, or recommendation logic changed.

## Text Changes

| Location | Before | After |
| --- | --- | --- |
| Requirement summary heading | `分析結果` | `您的需求條件` |
| `restartBtn` label | `重新分析` | `清空重填` |
| Two upload-lock messages | `請先按「重新分析」清除後再使用文件上傳` | `請先按「清空重填」清除後再使用文件上傳` |
| Restored-session message | `若要重新分析，請按「重新分析」。` | `若要重新開始，請按「清空重填」。` |
| Completed-condition message | `或重新分析。` | `或按「清空重填」重新開始。` |

## Guardrails Confirmed

- `AI分析結果` remains unchanged at the AI output section.
- `restartBtn` ID remains `restartBtn`.
- The event binding remains `refs.restartBtn.addEventListener("click", () => resetAgent(true));`.
- No `api/` files changed.

## Grep Results

```text
rg -n "重新分析" public/manufacturing.html
# no matches

rg -n "您的需求條件|AI分析結果|清空重填|restartBtn" public/manufacturing.html
464: 已有問答紀錄，請先按「清空重填」清除後再使用文件上傳
487: 已有問答紀錄，請先按「清空重填」清除後再使用文件上傳
528: 您的需求條件
532: restartBtn
533: 清空重填
549: AI分析結果
1497: 已還原上一輪方案探索結果。若要重新開始，請按「清空重填」。
1678: 已完成條件整理，可直接按「產生推薦」，或按「清空重填」重新開始。
2699: refs.restartBtn.addEventListener("click", () => resetAgent(true));
```

## Checks

```text
git diff --check
# passed

inline script syntax check
# passed
```

## Git

- Branch: `fix/manufacturing-advisor-wording-2026-09-04`
- Functional commit: `e1088e0cd11f4389d099f2d8af535faea2260227`
- Pull request: https://github.com/Pcc329/solution-finder/pull/142
