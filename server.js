var fs = require("fs");
var express = require("express");
var app = express();
// API-ish JSON response for express using basic fields (status, data, message). DRY.
require("json-response");
// Import Mongo DB
var mongodb = require("mongodb").MongoClient;
// Import Mongoose
var mongoose = require("mongoose");
// Regex for URL validation
var urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/|www\.)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/;

function makeShortenedURL() {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

// Set up default mongoose connection
var mongoDB =
  "mongodb://" +
  process.env.USER +
  ":" +
  process.env.PASS +
  "@" +
  process.env.HOST +
  ":" +
  process.env.DB_PORT +
  "/" +
  process.env.DB;
mongoose.connect(mongoDB, {
  useMongoClient: true
});
// Get the default connection
var db = mongoose.connection;
// Bind connection to error event (to get notification of connection errors)
db.on("error", console.error.bind(console, "MongoDB connection error:"));

// Creating a model
// Define schema
var Schema = mongoose.Schema;

var shortened_url_Schema = new Schema({
  fullUrl: String,
  shortenedUrl: String
});

// Compile model from schema
var shortened_url_model = mongoose.model("shortened_url", shortened_url_Schema);
// End of Creating a model

// Get user input from URL, query database for duplicate before creating shortened URL
app.get("/new/*", function(req, res) {
  // Save all URL text after /new/ in this var
  var shortened_url_to_create = req.params[0];
  // Check if /new/ URL is valid
  if (urlRegex.test(shortened_url_to_create)) {
    console.log(shortened_url_to_create + " is valid");
    // If URL is valid, search for existing record in schema
    shortened_url_model.findOne(
      { fullUrl: shortened_url_to_create },
      "-_id fullUrl shortenedUrl",
      function(err, matchFound) {
        if (err) return handleError(err);
        // If URL has already been shortened, inform user
        if (matchFound) {
          res.send(
            JSON.stringify(matchFound) +
              '<br/><br/>A shortened URL for "' +
              shortened_url_to_create +
              '" already exists: ' +
              matchFound.shortenedUrl +
              ".<br/><br/> Copy and paste this in to your browser's URL bar: " +
              "https://shorter-url.glitch.me/" +
              matchFound.shortenedUrl +
              "<br/><br/> or just " +
              '<a href="' +
              "https://shorter-url.glitch.me/" +
              matchFound.shortenedUrl +
              '">click here</a>'
          );
        } else {
          // Create a 5 random letter and number string for the shortened URL
          var randomString = makeShortenedURL();
          // Check if randomString is already in use, if so, run once more
          shortened_url_model.findOne({ shortenedUrl: randomString }, function(
            err,
            matchFound
          ) {
            if (err) return handleError(err);
            if (matchFound) {
              randomString = makeShortenedURL();
            }
          });
          // Create new mongodb document for shortened URL
          var new_instance = new shortened_url_model({
            fullUrl: shortened_url_to_create,
            shortenedUrl: randomString
          });
          console.log("New document created" + new_instance);

          var urlObj = {
            fullUrl: shortened_url_to_create,
            shortenedUrl: randomString
          };

          res.send(
            JSON.stringify(urlObj) +
              "<br/><br/>" +
              shortened_url_to_create +
              " has been shortened to: " +
              randomString +
              ".<br/><br/> Copy and paste this in to your browser's URL bar: " +
              "https://shorter-url.glitch.me/" +
              randomString +
              "<br/><br/> or just " +
              '<a href="' +
              "https://shorter-url.glitch.me/" +
              randomString +
              '">click here</a>'
          );
          // Save the new model instance, passing a callback
          new_instance.save(function(err) {
            if (err) return err;
            // saved!
          });
        }
      }
    );
    // If URL is invalid, inform user
  } else {
    console.log(shortened_url_to_create + " is invalid");
    res.send({
      Error:
        shortened_url_to_create +
        "is not a valid URL. URLs must begin with http://, https://, or www. Example: https://shorter-url.glitch.me/new/http://google.com'"
    });
  }
}); // close app.get

// Template
if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = [
      "https://narrow-plane.gomix.me",
      "https://www.freecodecamp.com"
    ];
    var origin = req.headers.origin || "*";
    if (!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1) {
      console.log(origin);
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
    }
    next();
  });
}

app.use("/public", express.static(process.cwd() + "/public"));

app.route("/_api/package.json").get(function(req, res, next) {
  console.log("requested");
  fs.readFile(__dirname + "/package.json", function(err, data) {
    if (err) return next(err);
    res.type("txt").send(data.toString());
  });
});

app.route("/").get(function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});
// Template

("use strict");

//
// Redirect to shortened URL
//
app.get("/*", function(req, res) {
  var shortenedUrlInput = req.params[0];

  shortened_url_model.findOne({ shortenedUrl: shortenedUrlInput }, function(
    err,
    matchFound
  ) {
    if (err) return handleError(err);
    if (matchFound) {
      console.log("redirecting to " + matchFound.fullUrl);
      res.redirect(matchFound.fullUrl);
    } else {
      res.send(
        "Please enter a valid shortened URL. To create a new shortened URL, enter in to the URL: https://shorter-url.glitch.me/new/website-to-be-added.com"
      );
    }
  });
});

// Respond not found to all the wrong routes
app.use(function(req, res, next) {
  res.status(404);
  res.type("txt").send("Not found");
});

// Error Middleware
app.use(function(err, req, res, next) {
  if (err) {
    res
      .status(err.status || 500)
      .type("txt")
      .send(err.message || "SERVER ERROR");
  }
});

function handleError(err, req, res, next) {
  res.status(500);
  res.render("error", { error: err });
}

app.listen(process.env.PORT, function() {
  console.log("Node.js listening ...");
});
