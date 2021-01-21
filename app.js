const express = require('express')
const app = express()
const multer = require('multer')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const jwt_decode = require('jwt-decode')
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')

app.use(cors())
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(express.static('uploads'))

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
const accessKey = 'verysecrettoken'
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

//  user Log In
app.post('/login', async function (req, res) {
  console.log('Body: email and pass : ', req.body.email, req.body.pass)
  const query = `SELECT user_name, email, pass, id_user FROM users WHERE email='${req.body.email}' AND pass='${req.body.pass}'`
  const resultQuery = await client.query(query)
  if (!resultQuery.rows[0]) {
    console.log('Wrong Password/Email or User doesnt exist.')
    return res.status(404).send('Wrong Password/Email or User doesnt exist.')
  } else {
  // return JWT
    const accessToken = await jwt.sign({ name: resultQuery.rows[0].user_name, email: resultQuery.rows[0].email, id: resultQuery.rows[0].id_user }, accessKey, { expiresIn: '1h' })
    console.log('aCcess Token is ::: ', accessToken)
    res.json(accessToken)
  }
})

// recover password
app.post('/recover', async function (req, res) {

  try {
    // check: Is user/email exists?
    const query = `SELECT email, id_user, pass FROM users WHERE email='${req.body.email}';`
    const result = await client.query(query)
    console.log('Request email :::::', req.body.email)
    // user exists
    if (!result.rows[0]) {
      console.log('User doesnt exist ! Recover canceled.')
      res.send(`Sorry, we can not find user with that email!  ${req.body.email}`)
    } else {
      // do JWT (for link) (hash-old-pass)+id
      console.log('id_user :::: ', result.rows[0].id_user)
      const secret = result.rows[0].pass + '-' + result.rows[0].id_user // oldPassHash + id
      const keyUrlForRecover = jwt.sign({ userId: result.rows[0].id_user }, secret, { expiresIn: 3600 })// 1 hour
      // write in DB keyUrlForRecover
      console.log('Recover url key : : : ', keyUrlForRecover)
      const queryInsert = `UPDATE users SET recover_token ='${keyUrlForRecover}' WHERE id_user = '${result.rows[0].id_user}';`
      client.query(queryInsert)
        .then(res => console.log('ADD recover-token success !'))
        .catch(e => console.error(e.stack))
  // send to email JWT for URL
      // const testEmailAccount = await nodemailer.createTestAccount()
      // const transporter = nodemailer.createTransport({
      //   host: 'smtp.ethereal.email',
      //   port: 587,
      //   secure: false,
      //   auth: {
      //     user: testEmailAccount.user,
      //     pass: testEmailAccount.pass
      //   }
      // })
      // const transporter = nodemailer.createTransport({
      //   service: 'gmail',
      //   auth: {
      //     user: 'zayacny@gmail.com',
      //     pass: ''
      //   }
      // })
    //   const resultEmail = await transporter.sendMail({
    //     from: '"Feedback recover password" ',
    //     to: 'nikolay.zaitsev@faceit.com.ua',
    //     subject: 'Message from Feedback',
    //     text: 'This message was sent from Feedback server. Please go towards.',
    //     html: ' <p> ' + `${keyUrlForRecover}` + '</p> '
    //   //   'some text some textsome textsome textsome textsome textsome textsome textsome textsome textsome textsome text' +
    //   // `This <i>message</i> was sent from <strong>Feedback site </strong> server. <a href="http://localhost:8080//${keyUrlForRecover}"</a>`
    //   })
    //   console.log('Result of send email :::', resultEmail)
    }
  } catch (err) {
    console.error('err in catch in POST Email/Recover::: ', err.stack)
    return res.status(500).json(err.stack)
  }
})

// registration new user
app.post('/user', async function (req, res) {
  const query = `INSERT INTO users (user_name, email, pass) VALUES ('${req.body.name}', '${req.body.email}', '${req.body.pass}');`
  client
    .query(query)
    .then(res => console.log('POST user in users succes !'))
    .catch(e => console.error(e.stack))
  res.send('Add new user success ! ')
})

// update user
app.post('/users/upd', async function (req, res) {
  const upd = `UPDATE users SET pass ='${req.body.pass}', recover_token='' WHERE email = '${req.body.email}';`
  client.query(upd)
    .then(res => console.log('New password saved succes !'))
    .catch(e => console.error(e.stack))
  res.send('Add new userPassword success ! ')
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
          console.log('INSERT company in "company" success', result.rows[0])
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

// fetch user email for recover
app.post('/email', async function (req, res) {
  const payloadJwt = jwt_decode(req.body.token, { payload: true })
  const query = `SELECT email FROM users WHERE id_user='${payloadJwt.userId}';`
  client
    .query(query)
    .then(result => {
      console.log('Email fetch done!')
      return res.json(result.rows[0].email)
    })
    .catch(e => console.error('Fetch email ', e.stack))
})

// post feedback
app.post('/feedbacks', function (req, res) {
  const reqJson = req.body.feedback
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
    .then(res => console.log('POST oneFeedback in feedbacks success'))
    .catch(e => console.error(e.stack))
  res.send('server/ feedbacks done')
})

// fetch Feedbacks from DB
app.get('/allfeedbacks', function (req, res) {
  pool.query('SELECT username, id_company, review, date, rate, name_img, feedbacks.id, name_company, address FROM feedbacks INNER JOIN company ON feedbacks.id_company=company.id;', (error, results) => { // inner join
    if (error) {
      throw error
    }
    res.status(200).json(results.rows)
  })
})
