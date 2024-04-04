
import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import util from 'util'
import MongoJs, { ObjectID, ObjectId } from 'mongojs'
import mustache from 'mustache'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'

import options from "./options.json" assert {type: "json"}

const app = express()
const router = express.Router();

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


const authenticateToken = (req, res, next) => {

  jwt.verify(req.cookies.AB, "vlad1", (err, jwt) => {
    if (err) next();
    Users.findOne({ phone: jwt.phone }, function (err, user) {
      if (err) return res.sendStatus(403)
      req.user = user
      console.log(user)
      next();
    })
  })
}

const authenticateApi = (req, res, next) => {

  if (req.body.user.phone && req.body.user.passwd) {
    Users.findOne({ phone: req.body.user.phone }, function (err, user) {
      if (err) {
        return res.sendStatus(500)
      }
      if (!user) { return res.sendStatus(401) }
      bcrypt.compare(req.body.user.passwd, user.passwd, function (err, valid) {
        if (err) {
          return res.sendStatus(500)
        }
        if (!valid) { return res.sendStatus(401) }

        req.mongo_user = user
        next();
      })
    })
  }
  else {
    next();
  }
}



app.get('/', authenticateToken, (req, res) => {

  let template;
  if (req.user) {
    const file = fs.readFileSync('public/main.html', 'utf-8');
    template = mustache.render(file, { "username": req.user.name });
  }
  else {
    const file = fs.readFileSync('public/index.html', 'utf-8');
    template = mustache.render(file, {});
  }
  res.send(template);

})

app.get('/index', (req, res) => {
  res.redirect('/')
})
app.get('/main', (req, res) => {
  res.redirect('/')
})

app.post('/api/add_group', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const group_name = req.body.group_name

  if (user && group_name) {

    Groups.findOne({ name: group_name, owner: user._id }, function (err, item) {
      console.log(item);
      if (!item) {
        Groups.insert({
          name: group_name,
          owner: user._id,
          members: [user._id]
        }, function (err, item) {
          res.send({
            id: item._id,
            name: item.name
          }
          )
        })
      }
      else {
        res.send({
          id: item._id,
          name: item.name
        })
      }
    })
  }
  else {
    res.status(400).send("Указал всё неправильно, глупый")
  }

})

app.post('/api/add_event', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const description = req.body.description
  const group_id = req.body.group_id
  const date = req.body.date

  if (user && description && group_id) {

    Groups.findOne({ _id: ObjectId(group_id) }, function (err, item) {
      if (!item) {
        res.status(400).send("Группа не найдена")
      }
      else {
        
        if(item.members.find(it => JSON.stringify(it) == JSON.stringify(user._id))){
          Events.findOne({ owner: user._id, description: description, date: date, group_id: group_id }, function (err, event) {
            if (!event) {
              Events.insert({ owner: user._id, description: description, date: date, group_id: group_id }, function (err, in_event) {
                res.send(in_event)
              })
            }
            else {
              res.send(event)
            }
          })
        }
        else{
          res.status(403).send("Тебе сюда нельзя")
        }
      }
    }
    )
  }
  else{
    res.sendStatus(401)
  }

})

app.post('/api/get_events', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const group_id = req.body.group_id

  if (user && group_id) {

    Groups.findOne({ _id: ObjectId(group_id) }, function (err, item) {
      if (!item) {
        res.status(400).send("Группа не найдена")
      }
      else {
        if(item.members.find(it => JSON.stringify(it) == JSON.stringify(user._id))){
          Events.find({group_id: group_id}, function(err, events){
            res.send(events)
          })
        }
        else{
          res.status(403).send("Тебе сюда нельзя")
        }
      }
    }
    )
  }
  else{
    res.sendStatus(401)
  }
})


app.post('/api/add_user', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const group_id = req.body.group_id
  const phone = req.body.phone

  if (user && group_id && phone) {

    Groups.findOne({ _id: ObjectId(group_id) }, function (err, group) {
      if (!group) {

        res.status(400).send({"answer" : "Группа не найдена"})
      }
      else {
        Users.findOne({phone : phone}, function(err, friend){
          if(!friend){
            res.status(400).send({"answer" : "Пользователь не найден"})
          }
          else{
            Groups.updateOne({_id: group._id}, { $addToSet: { members: ObjectId(friend._id) } }, function(err, grup){
              res.send(grup)
            })
          }
        })
      }
    }
    )
  }
  else{
    res.status(401).send({"answer" : "Не взламывай базу, пожалуйста"})
  }
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


app.use(express.static(process.cwd() + '/public'))

app.use(express.static(process.cwd() + '/public', {
  extensions: ['html']
}));


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