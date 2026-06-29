export async function withMinimumDelay<T>(task: Promise<T>, minimumMs = 350): Promise<T> {
  const [result] = await Promise.all([
    task,
    new Promise((resolve) => {
      window.setTimeout(resolve, minimumMs)
    }),
  ])
  return result
}
