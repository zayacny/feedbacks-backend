const express = require('express')
const app = express()
const multer = require('multer')
const cors = require('cors')
const bodyParser = require('body-parser')

app.use(cors())
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(express.static(__dirname))

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})

const {
  Pool,
  Client
} = require('pg') // "node-postgres"

const client = new Client({
  user: 'odmin',
  host: 'localhost',
  database: 'feedbacks',
  password: 'odmin',
  port: 5432
})
client.connect()

const pool = new Pool({
  user: 'odmin',
  host: 'localhost',
  database: 'feedbacks',
  password: 'odmin',
  port: 5432
})
const IMAGE_PATH = 'uploads/'
const upload = multer({
  dest: IMAGE_PATH
})

// load photo on server and Get the Name of file 
app.post('/upload', upload.single('fileImg'), function (req, res, next) {
  const filedata = req.file
  if (!filedata) {
    res.send('Error uploading file')
  } else {
    res.send(filedata.filename)
  }
})

// post user
app.post('/users', function (req, res) {
  const query = `INSERT INTO users VALUES ('${req.body.name}') `
  client
    .query(query)
    .then(res => console.log('POST user in users succes'))
    .catch(e => console.error(e.stack))
  res.send('server/ table users done')
})

// post company
app.post('/company', async function (req, res) {
  try {
    const query = `SELECT id FROM company WHERE name='${req.body.name}' AND address='${req.body.address}';`
    const resultQuery = await client.query(query)

    if (!resultQuery.rows[0]) { // if company NOT exists - add newone
      console.log('Company does not exist! We need an INSERT')
      const queryInsert = `INSERT INTO company (name, address) VALUES ('${req.body.name}', '${req.body.address}') RETURNING id;`
      client
        .query(queryInsert)
        .then(result => {
          console.log('INSERT company in "company" succes', result.rows[0])
          return res.json(result.rows[0].id)
        })
        .catch(err => {
          console.error(err.stack)
          return res.status(500).json(err.stack)
        })
    } else { // company exists - we have id
      console.log('We have Id ::::::  ', resultQuery.rows[0].id)
      return res.json(resultQuery.rows[0].id)
    }
  } catch (err) {
    console.error('err in catch in post/company::: ', err.stack)
    return res.status(500).json(err.stack)
  }
})

// post feedback
app.post('/feedbacks', function (req, res) {
  const reqJson = req.body.feedback
  console.log('id-company ::: ', reqJson.id_company)
  const query = `INSERT INTO feedbacks (username,  review, date, rate, id_company, name_img) VALUES ( 
    '${reqJson.userName}',
    '${reqJson.feedbackText}',
    '${reqJson.date}',
    ${reqJson.rate},
    ${reqJson.id_company},
    '${reqJson.filename_img}'
    ); `
  client
    .query(query)
    .then(res => console.log('POST oneFeedback in feedbacks succes'))
    .catch(e => console.error(e.stack))
  res.send('server/ feedbacks done')
})

// fetch Feedbacks from DB
app.get('/allfeedbacks', function (req, res) {
  pool.query('SELECT * FROM feedbacks;', (error, results) => {
    if (error) {
      throw error
    }
    res.status(200).json(results.rows)
  })
})