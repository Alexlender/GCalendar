
import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import util from 'util'
import MongoJs from 'mongojs'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'

import options from "./options.json" assert {type: "json"}
import { Hash } from 'crypto'

const app = express()

const host = "0.0.0.0"
const port = 3000
const connection_url = options.Mongo_string;

const Events = MongoJs(connection_url, ['Events']).Events;
const Groups = MongoJs(connection_url, ['Groups']).Groups;
const Plans = MongoJs(connection_url, ['Plans']).Plans;
const Users = MongoJs(connection_url, ['Users']).Users;


const urlencodedParser = express.urlencoded({ extended: false });

app.use(cookieParser('vlad1'));
app.use(bodyParser.json())

app.use(express.static(process.cwd() + '/public'))

app.use(express.static(process.cwd() + '/public', {
  extensions: ['html']
}));


app.get('/op', (req, res) => {

  let token = req.cookies.AB;

  console.log(token)

  jwt.verify(token, "vlad1", (err, user) => {
    if(err) return res.sendStatus(403)
    res.send(user.phone)
  })
  

})

app.get('/api/events', (req, res) => {

  const arg = req.query.search;

  //const search = arg ? { text: { $regex: arg, $options: "i" } } : {};
  const search = {};
  // console.log(search)
  Users.find(search, function (err, docs) {
    res.send(docs);
  })

})


app.post('/register', urlencodedParser, (req, res) => {

  const _phone = req.body.phone;
  const _name = req.body.name;
  const _passwd = req.body.passwd;

  if (_name && _passwd && _phone) {
    bcrypt.hash(_passwd, 10, function (err, hash) {
      if (err) { res.sendStatus(500) }
      else {
        Users.insert({ name: _name, passwd: hash, phone: _phone, icon: "/assets/img/default_icon.png" });
        res.redirect('/login');
      }
    })
  }
  else {
    res.sendStatus(400)
  }

})


app.post('/login', urlencodedParser, (req, res) => {

  if (!req.body.phone || !req.body.passwd) {

    return res.sendStatus(400)
  } else {
    var phone = req.body.phone
    var passwd = req.body.passwd
    Users.findOne({ phone: phone }, function (err, user) {
        if (err) {
          return res.sendStatus(500)
        }
        if (!user) { return res.sendStatus(401) }
        bcrypt.compare(passwd, user.passwd, function (err, valid) {
          if (err) {
            return res.sendStatus(500)
          }
          if (!valid) { return res.sendStatus(401) }
          let payload = { phone: phone || 0 };
          var token = jwt.sign(payload, "vlad1")
          res.cookie('AB', token)
          res.status(200).redirect('/')
        })
      })
  }

})



app.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
});


// Схема бд
// users
// [{
//     id: "",
//     name: "",
//     phone: "",
//     password: "",
//     icon: "",
//     tg_id: "",
//     groups: ["group_id", ...]

// }, ...]

// groups
// [{
//     id: "",
//     name: "",
//     owner: "",
//     members: ["user_id", ...]
// }, ...]

// events
// [{
//     id: "",
//     owner: "",
//     group_id: "",
//     description: "",
//     poll: [{id: "", status: ""}, ...],
//     date: ""
// }, ...]

// plans
// [{
//     id: "",
//     owner: "",
//     date: "",
//     description: ""
// }, ...]