const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')

app.use(cors())
app.use(bodyParser.json())
app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})

const { Client } = require('pg')// "node-postgres"
const client = new Client({
  user: 'odmin',
  host: 'localhost',
  database: 'feedbacks',
  password: 'odmin',
  port: 5432
})
client.connect()

app.post('/feeduser', function (req, res) { // load user
  const query = `INSERT INTO feeduser VALUES ('${req.body.name}') `// SQL
  client
    .query(query)
    .then(res => console.log('POST user in feeduser succes'))
    .catch(e => console.error(e.stack))
  res.send('server/ table feeduser done')
})

app.post('/feedbacks', function (req, res) { // load feedback
  const reqJson = req.body.oneFeedback
  // SQL
  const query = `INSERT INTO feedbacks VALUES ( 
    '${reqJson.userName}',
    '${reqJson.orgName}',
    '${reqJson.feedbackText}',
    '${reqJson.address}',
    '${reqJson.date}', 
    ${reqJson.rate}
    ); `
  console.log(query)
  client
    .query(query)
    .then(res => console.log('POST oneFeedback in feedbacks succes'))
    .catch(e => console.error(e.stack))
  res.send('server/ feedbacks done')
})
