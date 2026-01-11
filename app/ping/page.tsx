export default function PingPage() {
  return (
    <div style={{ padding: 50, textAlign: 'center' }}>
      <h1>Pong!</h1>
      <p>System is running.</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  )
}
