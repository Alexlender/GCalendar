
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

const Reacts = ["Agree", "Danya", "Maybe"]

var requests = {}

const urlencodedParser = express.urlencoded({ extended: false });

app.use(cookieParser('vlad1'));
app.use(bodyParser.json())

//хмм ммм

const authenticateToken = (req, res, next) => {

  jwt.verify(req.cookies.AB, "vlad1", (err, jwt) => {
    if (err) next();
    Users.findOne({ phone: jwt.phone }, function (err, user) {
      if (err) return res.sendStatus(403)
      req.user = user
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

        if (Date.now() - requests[user.phone] < 2000) {
          return res.sendStatus(500)
        }
        req.mongo_user = user
        requests[user.phone] = Date.now()
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
    template = mustache.render(file, { "username": req.user.name, "icon": req.user.icon });
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
        Groups.insert({ name: group_name, owner: user._id, members: [user._id] }, function (err, item) {
          Users.updateOne({ _id: ObjectId(user._id) }, { $addToSet: { groups: item._id } }, function (err, resuls) {
            res.send({ id: item._id, name: item.name })
          })
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
    res.status(400).send({ answer: "Указал всё неправильно, глупый" })
  }

})

app.post('/api/delete_group', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const group_id = req.body.group_id

  if (user && group_id) {

    Groups.findOne({ _id: ObjectId(group_id) }, function (err, item) {
      if (!item) {
        res.status(400).send({
          answer: "Нет такой группы"
        })
      }
      else {
        if (JSON.stringify(item.owner) == JSON.stringify(user._id)) {
          Users.updateMany({ groups: ObjectId(group_id) }, { $pull: { 'groups': ObjectId(group_id) } }, function () {
            Groups.remove({ _id: ObjectId(group_id) }, function (err, result) {
              res.send(result)
            })
          })
        }
        else {
          res.status(403).send({ answer: "Нет, ты не админ этой группы" })
        }
      }
    })
  }
  else {
    res.status(400).send({ answer: "Указал всё неправильно, глупый" })
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
        res.status(400).send({ answer: "Группа не найдена" })
      }
      else {

        if (item.members.find(it => JSON.stringify(it) == JSON.stringify(user._id))) {
          Events.findOne({ owner: user._id, description: description, date: date, group_id: group_id }, function (err, event) {
            if (!event) {
              Events.insert({ owner: user._id, description: description, date: date, group_id: group_id, poll: [{ user_id: user._id, status: "Agree" }] }, function (err, in_event) {
                res.send(in_event)
              })
            }
            else {
              res.send(event)
            }
          })
        }
        else {
          res.status(403).send({ answer: "Тебе сюда нельзя" })
        }
      }
    }
    )
  }
  else {
    res.sendStatus(401)
  }

})

app.post('/api/get_events', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const group_id = req.body.group_id

  if (user && group_id) {

    Groups.findOne({ _id: ObjectId(group_id) }, function (err, item) {
      if (!item) {
        res.status(400).send({ answer: "Группа не найдена" })
      }
      else {
        if (item.members.find(it => JSON.stringify(it) == JSON.stringify(user._id))) {
          Events.find({ group_id: group_id }, function (err, events) {
            res.send(events)
          })
        }
        else {
          res.status(403).send({ answer: "Тебе сюда нельзя" })
        }
      }
    }
    )
  }
  else {
    res.sendStatus(401)
  }
})

app.post('/api/add_plan', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const description = req.body.description
  const group_id = req.body.group_id
  const date = req.body.date

  if (user && description && group_id) {

    Groups.findOne({ _id: ObjectId(group_id) }, function (err, item) {
      if (!item) {
        res.status(400).send({ answer: "Группа не найдена" })
      }
      else {

        if (item.members.find(it => JSON.stringify(it) == JSON.stringify(user._id))) {
          Plans.findOne({ owner: user._id, description: description, date: date, group_id: group_id }, function (err, event) {
            if (!event) {
              Plans.insert({ owner: user._id, description: description, date: date, group_id: group_id }, function (err, in_event) {
                res.send(in_event)
              })
            }
            else {
              res.send(event)
            }
          })
        }
        else {
          res.status(403).send({ answer: "Тебе сюда нельзя" })
        }
      }
    }
    )
  }
  else {
    res.sendStatus(401)
  }
})

app.post('/api/get_plans', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const group_id = req.body.group_id
  const req_user = req.body.user_id


  if (user && group_id) {

    Groups.findOne({ _id: ObjectId(group_id) }, function (err, item) {
      if (!item) {
        res.status(400).send({ answer: "Группа не найдена" })
      }
      else {
        if (item.members.find(it => JSON.stringify(it) == JSON.stringify(user._id))) {
          if (req_user) {
            if (item.members.find(it => JSON.stringify(it) == JSON.stringify(req_user))) {
              Plans.find({ owner: ObjectId(req_user), group_id: group_id }, function (err, plans) {
                res.send(plans)
              })
            }
            else {
              res.status(400).send({ answer: "Пользователь косячный" })
            }
          }
          else {
            Plans.find({ group_id: group_id }, function (err, plans) {
              res.send(plans)
            })
          }
        }
        else {
          res.status(403).send({ answer: "Тебе сюда нельзя" })
        }
      }
    }
    )
  }
  else {
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

        res.status(400).send({ "answer": "Группа не найдена" })
      }
      else {
        Users.findOne({ phone: phone }, function (err, friend) {
          if (!friend) {
            return res.status(400).send({ "answer": "Пользователь не найден" })
          }

          Groups.updateOne({ _id: group._id }, { $addToSet: { members: ObjectId(friend._id) } }, function () {
            Users.updateOne({ _id: ObjectId(friend._id) }, { $addToSet: { groups: group._id } }, function (err, result) {
              res.send(result)
            })
          })

        })
      }
    }
    )
  }
  else {
    res.status(401).send({ "answer": "Не взламывай базу, пожалуйста" })
  }
})

app.post('/api/react_event', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const event_id = req.body.event_id
  const react = req.body.react

  if (!Reacts.includes(react)) {
    return res.status(400).send({ answer: 'Реакт может быть ["Agree", "Danya", "Maybe"]' })
  }

  if (!user || !react || !event_id) { return res.status(400).send("Неправильно заполнил поля") }

  Events.findOne({ _id: ObjectId(event_id) }, function (err, item) {
    if (!item) { return res.status(400).send({ answer: "Ивент не найден" }) }

    Groups.findOne({ "_id": ObjectId(item.group_id) }, function (err, group) {
      if (!group) { return res.status(400).send({ answer: "Группа этого ивента умерла" }) }

      if (group.members.find(it => JSON.stringify(it) != JSON.stringify(user._id))) {
        return res.status(403).send({ answer: "Тебе сюда нельзя" })
      }

      Events.updateOne({ "_id": ObjectId(event_id) }, { $pull: { 'poll': { "user_id": ObjectId(user._id) } } }, function () {
        Events.updateOne({ "_id": ObjectId(event_id) },
          { $addToSet: { poll: { user_id: user._id, status: react } } }, function () {
            Events.findOne({ "_id": ObjectId(event_id) }, function (err, result) {
              res.send(result)
            })
          })
      })
    })
  }
  )
})

app.post('/api/get_groups', authenticateApi, (req, res) => {

  const user = req.mongo_user

  if (!user) { return res.status(403).send({ answer: "Тебе сюда нельзя" }) }

  res.send({ groups: user.groups })

})

app.post('/api/get_group_info', authenticateApi, (req, res) => {

  const user = req.mongo_user
  const group_id = req.body.group_id

  if (!user || !group_id) { return res.status(401).send({ answer: "Тебе сюда нельзя" }) }

  Groups.findOne({ _id: ObjectId(group_id) }, function (err, item) {
    if (!item) { return res.status(400).send({ answer: "Группа не найдена" }) }

    if (item.members.find(it => JSON.stringify(it) != JSON.stringify(user._id))) {
      return res.status(403).send({ answer: "Тебе сюда нельзя" })
    }

    res.send(item)
  }
  )

})



app.post('/register', urlencodedParser, (req, res) => {

  const _phone = req.body.phone;
  const _name = req.body.name;
  const _passwd = req.body.passwd;

  if (!_name || !_passwd || !_phone) { return res.sendStatus(400) }

  bcrypt.hash(_passwd, 10, function (err, hash) {
    if (err) { return res.sendStatus(500) }

    Users.find({ phone: _phone }, function (err, item) {
      if (item) { return res.status(400).send("Пользователь с таким номером уже есть") }

      Users.insert({ name: _name, passwd: hash, phone: _phone, icon: "/assets/img/default_icon.png" });
      res.redirect('/login');
    })

  })

})

app.post('/login', urlencodedParser, (req, res) => {

  const phone = req.body.phone
  const passwd = req.body.passwd

  if (!req.body.phone || !phone) { return res.sendStatus(400) }

  Users.findOne({ phone: phone }, function (err, user) {
    if (err) { return res.sendStatus(500) }
    if (!user) { return res.sendStatus(401) }
    bcrypt.compare(passwd, user.passwd, function (err, valid) {
      if (err) { return res.sendStatus(500) }
      if (!valid) { return res.sendStatus(401) }
      let payload = { phone: phone || 0 };
      var token = jwt.sign(payload, "vlad1")
      res.cookie('AB', token)
      res.status(200).redirect('/')
    })
  })


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
//     group_id: "",
//     date: "",
//     description: ""
// }, ...]


// add_group()
// add_user()
// add_event()
// get_events()
// get_groups()
// add_plan()
// get_plans_by_user() //by user in group
// get_all_plans()

// react_event() //states ["agree", "danya", "maybe"]
// delete_group()


// delete_plan()
// delete_event()



//change_icon()



