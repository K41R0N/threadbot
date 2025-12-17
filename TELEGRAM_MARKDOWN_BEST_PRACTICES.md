# Telegram MarkdownV2 Best Practices

## Overview
This document outlines important considerations for sending messages to Telegram using MarkdownV2 format to prevent parsing errors.

## The Error We Fixed
**Error**: `Character '!' is reserved and must be escaped with the preceding '\'`

**Root Cause**: The `greeting` variable ("Good morning!" / "Good afternoon!") contained an unescaped exclamation mark.

**Fix Applied**: All message components are now properly escaped before being included in the message.

## Key Principles

### 1. **Escape ALL Text Content**
Every piece of text that goes into a Telegram message must be escaped, including:
- ✅ User-generated content (prompts, topics, dates)
- ✅ Hardcoded strings (greetings, labels, instructions)
- ✅ Dynamic content (formatted dates, user names)

**Exception**: Emojis don't need escaping (they're Unicode, not Markdown)

### 2. **Escape Order Matters**
The `escapeMarkdown` function escapes backslashes first, which is critical:
```typescript
.replace(/\\/g, '\\\\')   // Backslash must be first
```

This prevents double-escaping issues.

### 3. **Numbered Lists Are Fine**
When formatting prompts as numbered lists:
```typescript
content = prompt.prompts
  .map((p: string, i: number) => `${i + 1}. ${p}`)
  .join('\n');
```

Then escaping the entire `content` is correct. The periods in "1." "2." will be escaped to "1\." "2\.", which is valid MarkdownV2.

### 4. **Intentional Formatting**
If you want intentional Markdown formatting (like bold), you can use it, but:
- Make sure the rest of the message is escaped
- Don't mix escaped and unescaped content in the same string

**Example (Test Prompt):**
```typescript
const message = `🧪 *TEST PROMPT*\n\n📅 ${escapedDate}...`;
```
The `*TEST PROMPT*` is intentional bold formatting (fine), while `${escapedDate}` is escaped (correct).

## Special Characters That Must Be Escaped

According to Telegram's MarkdownV2 specification, these characters must be escaped:

| Character | Escaped As | Example |
|-----------|------------|---------|
| `\` | `\\` | Backslash |
| `*` | `\*` | Asterisk (bold) |
| `_` | `\_` | Underscore (italic) |
| `[` | `\[` | Link opening |
| `]` | `\]` | Link closing |
| `(` | `\(` | Link URL opening |
| `)` | `\)` | Link URL closing |
| `~` | `\~` | Strikethrough |
| `` ` `` | ``\` `` | Code |
| `>` | `\>` | Quote |
| `#` | `\#` | Header |
| `+` | `\+` | Unordered list |
| `-` | `\-` | Unordered list / minus |
| `=` | `\=` | Equals |
| `\|` | `\\|` | Table |
| `{` | `\{` | Curly brace |
| `}` | `\}` | Curly brace |
| `.` | `\.` | Dot (numbered lists) |
| `!` | `\!` | Exclamation |

## Current Implementation Status

### ✅ Properly Escaped
- `server/services/bot.ts` - Scheduled prompts (greeting, topic, content, date, label, reply text)
- `server/routers.ts` - Test prompts (date, topic, content)
- `app/api/webhook/route.ts` - Verification messages (already escaped)

### ⚠️ Things to Watch

1. **Prompt Content**: User-generated prompts may contain any special characters
   - ✅ **Fixed**: All prompts are escaped via `escapedContent`
   - ✅ **Fixed**: All topics are escaped via `escapedTopic`

2. **Numbered List Format**: "1. Question", "2. Question"
   - ✅ **Status**: Correct - periods are escaped, which is valid for MarkdownV2

3. **Emojis in Messages**: Emojis don't need escaping
   - ✅ **Status**: Emojis are fine as-is (🌅, 🌆, 🎯, 💬, etc.)

4. **Intentional Formatting**: Bold text like `*TEST PROMPT*`
   - ✅ **Status**: Fine as long as the rest of the message is escaped

## Common Pitfalls to Avoid

### ❌ DON'T: Mix Escaped and Unescaped
```typescript
// BAD
const message = `Hello! ${escapedContent}`; // "Hello!" not escaped!
```

### ✅ DO: Escape Everything
```typescript
// GOOD
const escapedGreeting = TelegramService.escapeMarkdown('Hello!');
const message = `${escapedGreeting} ${escapedContent}`;
```

### ❌ DON'T: Escape After Intentional Formatting
```typescript
// BAD
const boldText = '*Bold Text*';
const escaped = TelegramService.escapeMarkdown(boldText); // Escapes the * characters!
```

### ✅ DO: Apply Formatting After Escaping (if needed)
```typescript
// GOOD - Use MarkdownV2 syntax correctly
const escapedText = TelegramService.escapeMarkdown('Bold Text');
const message = `*${escapedText}*`; // Intentional bold
```

## Testing Checklist

When adding new Telegram messages, verify:

- [ ] All hardcoded strings are escaped
- [ ] All user-generated content is escaped
- [ ] All dynamic content (dates, names) is escaped
- [ ] Emojis are left unescaped (they're fine)
- [ ] Intentional Markdown formatting is applied correctly
- [ ] No mixing of escaped/unescaped content

## Future Considerations

1. **Consider a Helper Function**: Create a helper that automatically escapes all template string parts:
   ```typescript
   function telegramMessage(parts: string[], ...values: string[]) {
     const escaped = values.map(v => TelegramService.escapeMarkdown(v));
     // Build message with escaped values
   }
   ```

2. **Validation**: Add a test that sends sample messages with all special characters to ensure they work

3. **Documentation**: Keep this document updated when adding new message types

## Related Files

- `server/services/telegram.ts` - `escapeMarkdown()` function
- `server/services/bot.ts` - Scheduled prompt sending (✅ fixed)
- `server/routers.ts` - Test prompt sending (✅ already correct)
- `app/api/webhook/route.ts` - Verification messages (✅ already correct)
