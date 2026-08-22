import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const listingTaskSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ListingTaskView.vue'),
  'utf8',
)

const retryableFunction = listingTaskSource.match(
  /function taskRetryable\(row: ListingTask\)(?:: boolean)? \{([\s\S]*?)\n\}/,
)?.[1] || ''

for (const retryableStatus of ["'failed'", "'partial'", "'cancelled'"]) {
  if (!retryableFunction.includes(retryableStatus)) {
    throw new Error(`${retryableStatus} listing tasks must remain retryable`)
  }
}

for (const nonRetryableStatus of ["'success'", "'queued'", "'running'"]) {
  if (retryableFunction.includes(nonRetryableStatus)) {
    throw new Error(`${nonRetryableStatus} listing tasks must not be retryable`)
  }
}

if (!listingTaskSource.includes('v-if="taskRetryable(row)"')) {
  throw new Error('listing task retry button must use the retryable status guard')
}

const groupRetryableFunction = listingTaskSource.match(
  /function groupTaskRetryable\(row: ListingTask\)(?:: boolean)? \{([\s\S]*?)\n\}/,
)?.[1] || ''

if (!groupRetryableFunction.includes('children.every')) {
  throw new Error('group retry must wait until every child task is finished')
}

if (!groupRetryableFunction.includes('!taskInProgress(child)')) {
  throw new Error('group retry must hide while a child task is queued or running')
}

if (listingTaskSource.includes('v-if="taskFinished(row)"')) {
  throw new Error('listing task retry button must not use the generic finished status guard')
}

for (const pollingPattern of ['progressTimer', 'setInterval', 'syncProgressPolling']) {
  if (listingTaskSource.includes(pollingPattern)) {
    throw new Error(`listing task view must not poll automatically: ${pollingPattern}`)
  }
}

if (!listingTaskSource.includes('void loadTasks()')) {
  throw new Error('listing task view must load task data when mounted')
}
