
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'

const app = new Hono()
const db = new Database('students.db')

// สร้างตารางนักศึกษา
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    studentId TEXT PRIMARY KEY,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    birthDate TEXT NOT NULL,
    gender TEXT NOT NULL
  )
`)

// หน้าเว็บหลัก
app.get('/', (c) => {
  const html = readFileSync('./index.html', 'utf8')
  return c.html(html)
})

// GET - ดูข้อมูลนักศึกษาทั้งหมด
app.get('/students', (c) => {
  const students = db.prepare('SELECT * FROM students').all()
  return c.json(students)
})

// GET - ดูข้อมูลนักศึกษาตามรหัส
app.get('/students/:id', (c) => {
  const id = c.req.param('id')

  const student = db.prepare(
    'SELECT * FROM students WHERE studentId = ?'
  ).get(id)

  if (!student) {
    return c.json({ error: 'Student not found' }, 404)
  }

  return c.json(student)
})

// POST - เพิ่มข้อมูลนักศึกษา
app.post('/students', async (c) => {
  let data

  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { studentId, firstName, lastName, birthDate, gender } = data || {}

  if (!studentId || !firstName || !lastName || !birthDate || !gender) {
    return c.json({ error: 'Please fill all fields' }, 400)
  }

  try {
    db.prepare(`
      INSERT INTO students
      (studentId, firstName, lastName, birthDate, gender)
      VALUES (?, ?, ?, ?, ?)
    `).run(studentId, firstName, lastName, birthDate, gender)

    return c.json({ message: 'Student added successfully' }, 201)
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
        error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return c.json({ error: 'Student ID already exists' }, 409)
    }

    return c.json({ error: 'Cannot add student' }, 500)
  }
})

// PUT - แก้ไขข้อมูลนักศึกษา
app.put('/students/:id', async (c) => {
  const id = c.req.param('id')
  let data

  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { firstName, lastName, birthDate, gender } = data || {}

  if (!firstName || !lastName || !birthDate || !gender) {
    return c.json({ error: 'Please fill all fields' }, 400)
  }

  const result = db.prepare(`
    UPDATE students
    SET firstName = ?,
        lastName = ?,
        birthDate = ?,
        gender = ?
    WHERE studentId = ?
  `).run(firstName, lastName, birthDate, gender, id)

  if (result.changes === 0) {
    return c.json({ error: 'Student not found' }, 404)
  }

  return c.json({ message: 'Student updated successfully' })
})

// DELETE - ลบข้อมูลนักศึกษา
app.delete('/students/:id', (c) => {
  const id = c.req.param('id')

  const result = db.prepare(
    'DELETE FROM students WHERE studentId = ?'
  ).run(id)

  if (result.changes === 0) {
    return c.json({ error: 'Student not found' }, 404)
  }

  return c.json({ message: 'Student deleted successfully' })
})

// เริ่มต้น Server
serve({
  fetch: app.fetch,
  port: 3000
})

console.log('Server running at http://localhost:3000')
