const express = require('express')
const app = express()
const multer = require('multer')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')
require('./template-mail')
require('dotenv').config()

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
const htmlText = require('./template-mail')

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_USER_PASS,
  port: process.env.PORT
})

client.connect()

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_USER_PASS,
  port: process.env.PORT
})
const secretKey = process.env.ACCESS_KEY
var secretForRecoverPass = ''
const upload = multer({
  dest: process.env.IMAGE_PATH
})

// load photo on server and Get the Name of file
app.post('/upload', upload.single('fileImg'), function (req, res, next) {
  const filedata = req.file
  if (!filedata) {
    return res.status(406).json({
      status: 'failed',
      message: 'Error uploading file. Mis file data.'
    })
  } else {
    return res.json({
      status: 'success',
      filename: filedata.filename
    })
  }
})

//  user Log In
app.post('/login', async function (req, res) {
  try {
    const query = 'SELECT user_name, email, pass, id_user FROM users WHERE email=$1 AND pass=$2'
    const resultQuery = await client.query(query, [req.body.email, req.body.pass])
    if (resultQuery.rows.length) {
      // return JWT
      const accessToken = await jwt.sign({
        name: resultQuery.rows[0].user_name,
        email: resultQuery.rows[0].email,
        id: resultQuery.rows[0].id_user
      },
      secretKey, {
        expiresIn: '1h'
      })
      return res.json({
        status: 'success',
        accessToken: accessToken
      })
    }
  } catch (e) {
    console.log(e.stack)
    return res.status(404).json({
      status: 'failed',
      message: 'Wrong Password/Email or User doesnt exist.'
    })
  }
})

// recover password
app.post('/recover', async function (req, res) {
  try {
    // check: Is user/email exists?
    const query = 'SELECT email, id_user, pass FROM users WHERE email=$1'
    const result = await client.query(query, [req.body.email])
    // user not exists
    if (!result.rows.length) {
      return res.status(404).json({
        status: 'failed',
        message: 'Sorry, we can not find user with that email!'
      })
    }
    // User exists. Do JWT (for link) (hash-old-pass)+id
    // const emailDestination = result.rows[0].email
    secretForRecoverPass = result.rows[0].pass + '-' + result.rows[0].id_user // oldPassHash + id
    const keyUrlForRecover = jwt.sign({
      userId: result.rows[0].id_user
    }, secretForRecoverPass, {
      expiresIn: 60
    })

    // write in DB keyUrlForRecover
    const queryInsert = 'UPDATE users SET recover_token=$1 WHERE id_user=$2'
    await client.query(queryInsert, [keyUrlForRecover, result.rows[0].id_user])

    // send to email JWT for URL
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    })
    const mail = {
      from: 'Feedback recover password <zayacny@gmail.com>',
      to: 'zayacny@ukr.net', // emailDestination
      subject: 'Message from Feedback',
      text: 'This message was sent from Feedback server. Please go towards.',
      html: htmlText(keyUrlForRecover)
    }
    transporter.sendMail(mail, (error, response) => {
      if (error) {
        console.log(error.stack)
      } else {
        console.log('Mail sent.')
        transporter.close()
        return res.status(200).json({
          status: 'success',
          message: 'Email for recover pass have sent.'
        })
      }
    })
  } catch (err) {
    return res.status(500).send(err.stack)
  }
})

// registration new user
app.post('/user', async function (req, res) {
  const query = 'INSERT INTO users (user_name, email, pass) VALUES ($1, $2, $3)'
  try {
    await client.query(query, [req.body.name, req.body.email, req.body.pass])
    console.log('POST user in users succes !')
    return res.json({
      status: 'success',
      message: 'Add new user success !'
    })
  } catch (e) {
    console.error(e.stack)
    return res.status(400).json({
      status: 'failed',
      message: 'Add new user failed !'
    })
  }
})

// update user
app.post('/users/upd', async function (req, res) {
  try {
    const upd = 'UPDATE users SET pass=$1, recover_token=null WHERE email=$2'
    await client.query(upd, [req.body.pass, req.body.email])
    console.log('New password saved succes !')
    return res.json({
      status: 'success',
      message: 'Update user success !'
    })
  } catch (e) {
    console.error(e.stack)
    return res.status(400).json({
      status: 'failed',
      message: 'Update user failed !'
    })
  }
})

// post company
app.post('/company', async function (req, res) {
  try {
    const query = 'SELECT id FROM company WHERE name=$1 AND address=$2'
    const resultQuery = await client.query(query, [req.body.name, req.body.address])
    if (resultQuery.rows.length) {
      // company exists - we have id
      return res.json({
        status: 'success',
        id: resultQuery.rows[0].id
      })
    }
    // if company NOT exists - add newone
    const queryInsert = 'INSERT INTO company (name, address) VALUES ($1, $2) RETURNING id'
    const result = await client.query(queryInsert, [req.body.name, req.body.address])
    if (resultQuery.rows.length) {
      return res.json({
        status: 'success',
        message: 'Added new company.',
        id: result.rows[0].id
      })
    }
  } catch (err) {
    console.error(err.stack)
    return res.status(500).json({
      status: 'failed',
      message: 'Company not added. Query not done.'
    })
  }
})

// fetch user email for recover
app.post('/email', async function (req, res) {
  try {
    const payloadJwt = await jwt.verify(req.body.token, secretForRecoverPass)
    console.log('verify JWT  done ::: ', payloadJwt)
    const query = 'SELECT email FROM users WHERE id_user=$1'
    const result = await client.query(query, [payloadJwt.userId])
    return res.json({
      status: 'success',
      message: 'Key for reset password verifyed.',
      userEmail: result.rows[0].email
    })
  } catch (err) {
    console.log(err.stack)
    return res.status(404).json({
      status: 'failed',
      message: 'The Link for reset password deprecated. Plese go to "Forgot Password.'
    })
  }
})

// post feedback
app.post('/feedbacks', function (req, res) {
  try {
    const reqJson = req.body.feedback
    const query = 'INSERT INTO feedbacks (username,  review, date, rate, id_company, name_img) VALUES ($1, $2, $3, $4, $5, $6)'
    client.query(query, [reqJson.userName, reqJson.feedbackText, reqJson.date, reqJson.rate, reqJson.id_company, reqJson.filename_img])
    return res.json({
      status: 'success',
      message: 'POST oneFeedback in feedbacks success.'
    })
  } catch (err) {
    console.log(err.stack)
    return res.status(400).json({
      status: 'failed',
      message: 'Query INSERT failed.'
    })
  }
})

// fetch Feedbacks from DB
app.get('/allfeedbacks', function (req, res) {
  const query = `SELECT username, id_company, review, date, rate, name_img, feedbacks.id, name_company, address 
  FROM feedbacks 
  INNER JOIN company 
  ON feedbacks.id_company=company.id;`
  pool.query(query, (error, results) => { // inner join
    if (error) {
      throw error
    }
    return res.status(200).json(results.rows)
  })
})