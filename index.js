import { Hono } from 'hono'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'

const app = new Hono()
let sql
let schemaReady

async function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  sql ??= neon(process.env.DATABASE_URL)
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS students (
        "studentId" TEXT PRIMARY KEY,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "birthDate" TEXT NOT NULL,
        gender TEXT NOT NULL
      )
    `.catch((error) => { schemaReady = undefined; throw error })
  }
  await schemaReady
  return sql
}

app.onError((error, c) => {
  console.error('API request failed', { code: error.code, name: error.name })
  return c.json({ error: 'Database unavailable. Check server configuration.' }, 500)
})

app.get('/', (c) => c.html(readFileSync(new URL('./index.html', import.meta.url), 'utf8')))

app.get('/students', async (c) => {
  const db = await database()
  return c.json(await db`SELECT * FROM students ORDER BY "studentId"`)
})

app.get('/students/:id', async (c) => {
  const db = await database()
  const [student] = await db`SELECT * FROM students WHERE "studentId" = ${c.req.param('id')}`
  return student ? c.json(student) : c.json({ error: 'Student not found' }, 404)
})

app.post('/students', async (c) => {
  let data
  try { data = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const { studentId, firstName, lastName, birthDate, gender } = data || {}
  if (![studentId, firstName, lastName, birthDate, gender].every(v => typeof v === 'string' && v.trim())) {
    return c.json({ error: 'Please fill all fields' }, 400)
  }
  try {
    const db = await database()
    await db`INSERT INTO students ("studentId", "firstName", "lastName", "birthDate", gender)
      VALUES (${studentId}, ${firstName}, ${lastName}, ${birthDate}, ${gender})`
    return c.json({ message: 'Student added successfully' }, 201)
  } catch (error) {
    if (error.code === '23505') return c.json({ error: 'Student ID already exists' }, 409)
    throw error
  }
})

app.put('/students/:id', async (c) => {
  let data
  try { data = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const { firstName, lastName, birthDate, gender } = data || {}
  if (![firstName, lastName, birthDate, gender].every(v => typeof v === 'string' && v.trim())) {
    return c.json({ error: 'Please fill all fields' }, 400)
  }
  const db = await database()
  const rows = await db`UPDATE students SET "firstName" = ${firstName}, "lastName" = ${lastName},
    "birthDate" = ${birthDate}, gender = ${gender} WHERE "studentId" = ${c.req.param('id')} RETURNING "studentId"`
  return rows.length ? c.json({ message: 'Student updated successfully' }) : c.json({ error: 'Student not found' }, 404)
})

app.delete('/students/:id', async (c) => {
  const db = await database()
  const rows = await db`DELETE FROM students WHERE "studentId" = ${c.req.param('id')} RETURNING "studentId"`
  return rows.length ? c.json({ message: 'Student deleted successfully' }) : c.json({ error: 'Student not found' }, 404)
})

export default app
