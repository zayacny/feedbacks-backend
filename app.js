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

const htmlText = require('./template-mail')

const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.HOST,
    user: process.env.DB_USER,
    password: process.env.DB_USER_PASS,
    database: process.env.DB_NAME,
    port: process.env.PORT
  }
})

const secretKey = process.env.ACCESS_KEY
var secretForRecoverPass = ''
const upload = multer({
  dest: process.env.IMAGE_PATH
})

const bookshelf = require('bookshelf')(knex)

const Company = bookshelf.model(
  'Company',
  {
    tableName: 'company',
    feedbacks () {
      return this.hasMany('Feedback')
    }
  })

const Feedback = bookshelf.model(
  'Feedback',
  {
    tableName: 'feedbacks',
    company () {
      return this.belongsTo('Company')
    }
  })

const User = bookshelf.model(
  'User',
  {
    tableName: 'users'
  })

// all feedbacks of one company
// app.get('/allfeedbacks/:company_id', async function (req, res) {
//   new Company({ id: 42 }).fetch({ withRelated: ['feedbacks'] })
//     .then((companies) => {
//       console.log(companies.toJSON())
//     })
// })

// fetch Feedbacks from DB
app.get('/allfeedbacks', async function (req, res) {
  new Feedback().fetchAll({ withRelated: ['company'] })
    .then(result => {
      console.log('Fetch all feedbacks success', result.toJSON())
      return res.status(200).json(result)
    })
    .catch((e) => {
      console.error(e.stack)
      return res.status(400).json({
        status: 'failed',
        message: 'Get all feedbacks failed !'
      })
    })
})

// load photo on server and Get the Name of file
app.post('/upload', upload.single('fileImg'), function (req, res) {
  const filedata = req.file
  if (!filedata) {
    return res.status(406).json({
      status: 'failed',
      message: 'Error uploading file. Mis file data.'
    })
  } else {
    return res.json({
      status: 'success',
      fileName: filedata.filename
    })
  }
})

//  user Log In
app.post('/login', async function (req, res) {
  try {
    // email & pass authentication
    let result = await User.where({ email: req.body.email, pass: req.body.pass })
      .fetch({ columns: ['user_name', 'email', 'pass', 'id_user'] })
    result = result.toJSON()
    if (result) {
      // authentication done - return JWT
      const accessToken = await jwt.sign({
        name: result.user_name,
        email: result.email,
        id: result.id_user
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
    // check: Does user/email exist?
    let result = await User.where({ email: req.body.email })
      .fetch({ columns: ['user_name', 'email', 'pass', 'id_user'] })

    // user not exists
    if (!result) {
      return res.status(404).json({
        status: 'failed',
        message: 'Sorry, we can`t find user with that email!'
      })
    }
    // User exists. Do JWT (for link) (hash-old-pass)+id
    result = result.toJSON()
    // const emailDestination = result.email
    secretForRecoverPass = result.pass + '-' + result.id_user // oldPassHash + id
    const keyUrlForRecover = jwt.sign({
      userId: result.id_user
    }, secretForRecoverPass, {
      expiresIn: '1h'
    })
    // write in DB keyUrlForRecover
    await User.where({ id_user: result.id_user })
      .save(
        { recover_token: keyUrlForRecover },
        { method: 'update', patch: true }
      )

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
  } catch (e) {
    return res.status(500).json({
      status: 'failed',
      message: 'Fail create recover-pass-key OR sending email.'
    })
  }
})

// registration new user
app.post('/users', async function (req, res) {
  try {
    await User.forge().save({
      user_name: req.body.name,
      email: req.body.email,
      pass: req.body.pass
    })
    console.log('POST user in users succes !')
    return res.json({
      status: 'success',
      message: 'Add new user success !'
    })
  } catch (e) {
    console.error(e.stack)
    return res.status(400).json({
      status: 'failed',
      message: 'Add new user failed or user-name already exist.'
    })
  }
})

// update user
app.post('/users/upd', async function (req, res) {
  User.where({ email: req.body.email })
    .save(
      { pass: req.body.pass },
      { method: 'update', patch: true }
    )
    .then(result => {
      console.log(result)
      return res.json({
        status: 'success',
        message: 'Update user success !'
      })
    })
    .catch((e) => {
      console.error(e.stack)
      return res.status(400).json({
        status: 'failed',
        message: 'Update user failed !'
      })
    })
})

// post company
app.post('/company', async function (req, res) {
  try {
    const result = await Company.where({ name_company: req.body.name, address: req.body.address })
      .fetch({ require: false, columns: 'id' })
    if (result) { // company exists
      return res.json({
        status: 'success',
        message: 'Company exists !'
      })
    }
    // company not exists, INSERT new company
    const responseDB = await Company.forge().save({ name_company: req.body.name, address: req.body.address })
    console.log('Company Save done !')
    return res.status(200).json({
      status: 'success',
      message: 'New company added successfull',
      id_company: responseDB.id
    })
  } catch (e) {
    console.log(e.stack)
    return res.status(400).json({
      status: 'failed',
      message: 'Company find or add failed !'
    })
  }
})

// fetch user email for recover
app.post('/email', async function (req, res) {
  const payloadJwt = await jwt.verify(req.body.token, secretForRecoverPass)
  console.log('verify JWT  done ::: ', payloadJwt)
  User.where({ id_user: payloadJwt.userId })
    .fetch({ columns: 'email' }) // SELECT email WHERE id=(id from token)
    .then(result => {
      console.log('email ::: ', result.toJSON().email)
      return res.json({
        status: 'success',
        message: 'Key for reset password verifyed.',
        userEmail: result.toJSON().email
      })
    })
    .catch(e => {
      console.log(e.stack)
      return res.status(404).json({
        status: 'failed',
        message: 'The Link for reset password deprecated. Plese go to "Forgot Password.'
      })
    })
})

// post feedback
app.post('/feedbacks', function (req, res) {
  const reqJson = req.body.feedback
  console.log('req.body ::: ', reqJson)
  Feedback.forge().save({ // INSERT in feedbacks
    username: reqJson.userName,
    review: reqJson.feedbackText,
    date: reqJson.date,
    rate: reqJson.rate,
    company_id: reqJson.id_company,
    name_img: reqJson.fileNameImg
  })
    .then((feedback) => {
      console.log('[posted feedback success]', feedback)
      return res.json({
        status: 'success',
        message: 'POST oneFeedback in feedbacks success.'
      })
    })
    .catch((e) => {
      console.log(e.stack)
      return res.status(400).json({
        status: 'failed',
        message: 'Query INSERT failed.'
      })
    })
})
