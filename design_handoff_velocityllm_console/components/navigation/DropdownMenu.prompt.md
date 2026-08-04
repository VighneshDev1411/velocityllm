Click-triggered floating menu, used for the profile menu in TopBar and row actions in tables.

```jsx
<DropdownMenu
  trigger={<Avatar />}
  align="end"
  items={[
    { label: 'Profile', icon: <Icon name="user" size={16}/>, onClick: goProfile },
    { separator: true },
    { label: 'Logout', icon: <Icon name="log-out" size={16}/>, danger: true, onClick: logout },
  ]}
/>
```
