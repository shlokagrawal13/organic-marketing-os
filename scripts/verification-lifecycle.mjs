// Keep bounded asynchronous verification alive when Node has only unreferenced timers.
export function keepVerificationAlive() {
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer);
}
