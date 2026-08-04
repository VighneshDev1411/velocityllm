Modal dialog for confirmations, create/edit forms, and detail views. Click the backdrop or the × to close.

```jsx
<Dialog open={open} onClose={() => setOpen(false)} title="Delete API key?"
  description="This action cannot be undone." footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button variant="destructive">Delete</Button></>}>
  <p>Requests using this key will be rejected immediately.</p>
</Dialog>
```
