A single-choice dropdown. Click the trigger to reveal a floating option list with a checkmark on the active item.

```jsx
<Select
  placeholder="Choose a model"
  options={[{ value: 'gpt-4', label: 'GPT-4' }, { value: 'claude', label: 'Claude' }]}
  value={model}
  onChange={setModel}
/>
```
