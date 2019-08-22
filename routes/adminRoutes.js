const express = require("express");
const adminRouter = express.Router();

const multer = require("multer");

// Set storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now());
  }
});

const upload = multer({ storage: storage });

// Middlewares for Auth
const checkSignIn = require("../middlewares/checkSignIn");
const returnToDash = require("../middlewares/returnToDash");

// LowDB Instances
//See https://github.com/typicode/lowdb for docs
const low = require("lowdb");
const FileAsync = require("lowdb/adapters/FileAsync");

// Participants DB
const participantAdapter = new FileAsync("./data/participants.json");
// Upcoming Events DB
const upcomingAdapter = new FileAsync("./data/upcoming-events.json");
// Industrial Visit DB
const industrialAdapter = new FileAsync("./data/industrial-visits.json");
// Former Events DB
const formerAdapter = new FileAsync("./data/former-events.json");

//----- ADMIN ROUTES -----//

adminRouter.use((req, res, next) => {
  if (req.cookies.admin_key && !req.session.admin) {
    res.clearCookie("admin_key");
  }
  next();
});

// Login Route
adminRouter.get("/login", (req, res) => {
  // use res.render to load up an ejs view file
  // login page
  res.render("admin/login", { succ: false, err: false });
});

// Login Route
adminRouter.post("/login", (req, res) => {
  let { adminUsername, adminPassword } = req.body;

  if (!adminUsername || !adminPassword) {
    res.render("admin/login", {
      succ: false,
      err: true
    });
  } else {
    if (adminUsername == "admin" && adminPassword == "admin") {
      let adminValues = [
        {
          username: adminUsername
        }
      ];
      req.session.admin = adminValues;
      res.redirect("/dashboard");
      // console.log("Admin logged in.");
    } else {
      res.render("admin/login", {
        succ: false,
        err: true
      });
    }
  }
});

low(formerAdapter).then(formerDB => {
  low(participantAdapter).then(participantDB => {
    low(upcomingAdapter).then(upcomingDB => {
      low(industrialAdapter).then(industrialDB => {
        // LowDB API
        const upcoming = upcomingDB.get("upcoming").value();
        const former = formerDB.get("former").value();
        const industrial = industrialDB.get("industrial").value();

        //  Dashboard Route
        adminRouter.get("/dashboard", checkSignIn, (req, res) => {
          res.render("admin/dashboard", {
            formerEvents: former,
            upcomingEvents: upcoming,
            visits: industrial,
            swalsucc: false,
            swalerr: false
          });
        });

        //  Info Route
        adminRouter.get("/info/:event", checkSignIn, (req, res) => {
          const checkEventID = upcomingDB
            .get("upcoming")
            .filter({ title: req.params.event })
            .map("id")
            .value();

          const eventIDforParticipants = checkEventID.toString();

          const participantsToDisplay = participantDB
            .get("participants")
            .filter({ eventID: eventIDforParticipants })
            .value();

          if (!participantsToDisplay) {
            res.render("admin/info", {
              err: true,
              succ: false,
              upcomingEvents: upcoming,
              event: req.params.event
            });
          } else {
            res.render("admin/info", {
              err: false,
              succ: true,
              upcomingEvents: upcoming,
              event: req.params.event,
              participants: participantsToDisplay
            });
          }
        });

        //  Delete Route
        adminRouter.post("/delete/:event", checkSignIn, (req, res) => {
          // use res.render to load up an ejs view file
          // admin panel
          let itemtoDelete = req.params.event;

          const getUpcoming = upcomingDB
            .get("upcoming")
            .find({ title: itemtoDelete })
            .value();
          //console.log(getUpcoming);
          const getFormer = formerDB
            .get("former")
            .find({ title: itemtoDelete })
            .value();
          const getIndustrial = industrialDB
            .get("industrial")
            .find({ title: itemtoDelete })
            .value();

          if (!itemtoDelete) {
            res.render("admin/dashboard", {
              formerEvents: former,
              upcomingEvents: upcoming,
              visits: industrial,
              swalsucc: false,
              swalerr: true
            });
          } else if (getUpcoming) {
            upcomingDB
              .get("upcoming")
              .remove({ title: itemtoDelete })
              .write();

            res.render("admin/dashboard", {
              formerEvents: former,
              upcomingEvents: upcoming,
              visits: industrial,
              swalsucc: true,
              swalerr: false
            });
          } else if (getFormer) {
            formerDB
              .get("former")
              .remove({ title: itemtoDelete })
              .write();

            res.render("admin/dashboard", {
              formerEvents: former,
              upcomingEvents: upcoming,
              visits: industrial,
              swalsucc: true,
              swalerr: false
            });
          } else if (getIndustrial) {
            industrialDB
              .get("industrial")
              .remove({ title: itemtoDelete })
              .write();

            res.render("admin/dashboard", {
              formerEvents: former,
              upcomingEvents: upcoming,
              visits: industrial,
              swalsucc: true,
              swalerr: false
            });
          } else {
            res.render("admin/dashboard", {
              formerEvents: former,
              upcomingEvents: upcoming,
              visits: industrial,
              swalsucc: false,
              swalerr: true
            });
          }
        });

        // Modify Route
        adminRouter.get("/modify/:event", checkSignIn, (req, res) => {
          res.render("admin/modify", {
            formerEvents: former,
            upcomingEvents: upcoming,
            visits: industrial,
            event: req.params.event,
            succ: false,
            err: false
          });
        });

        //  Add Route
        adminRouter.get("/add/:event", checkSignIn, (req, res) => {
          res.render("admin/add", {
            formerEvents: former,
            upcomingEvents: upcoming,
            visits: industrial,
            event: req.params.event,
            succ: false,
            err: false
          });
        });

        // Add New Items
        adminRouter.post(
          "/add/:event",
          checkSignIn,
          upload.array("myFiles", 12),
          (req, res) => {
            let checkEvent = req.params.event;

            // For Upcoming Events

            if (checkEvent == "upcoming") {
              let {
                titleForUpcoming,
                briefForUpcoming,
                detailsForUpcoming,
                dateForUpcoming
              } = req.body;
              const files = req.files;
              if (
                !titleForUpcoming ||
                !briefForUpcoming ||
                !detailsForUpcoming ||
                !dateForUpcoming
              ) {
                res.render("admin/add", {
                  formerEvents: former,
                  upcomingEvents: upcoming,
                  visits: industrial,
                  event: checkEvent,
                  succ: false,
                  err: true
                });
                //res.status(400);
              } else {
                upcomingDB
                  .get("upcoming")
                  .push({
                    title: titleForUpcoming,
                    date: dateForUpcoming,
                    brief: briefForUpcoming,
                    details: detailsForUpcoming
                  })
                  .last()
                  .assign({ id: Date.now().toString() })
                  .write();

                res.render("admin/add", {
                  formerEvents: former,
                  upcomingEvents: upcoming,
                  visits: industrial,
                  event: checkEvent,
                  succ: true,
                  err: false
                });
              }
            }

            // For Industrial Visits

            if (checkEvent == "industrial") {
              let {
                titleForVisit,
                stagesForVisit,
                detailsForVisit,
                dateForVisit
              } = req.body;
              const files = req.files;
              let time = Date.now().toString();

              if (
                !titleForVisit ||
                !stagesForVisit ||
                !dateForVisit ||
                !detailsForVisit
              ) {
                res.render("admin/add", {
                  formerEvents: former,
                  upcomingEvents: upcoming,
                  visits: industrial,
                  event: checkEvent,
                  succ: false,
                  err: true
                });
                // res.status(400);
              } else {
                industrialDB
                  .get("industrial")
                  .push({
                    title: titleForVisit,
                    date: dateForVisit,
                    stages: [stagesForVisit],
                    details: detailsForVisit,
                    key: "IV" + time
                  })
                  .last()
                  .assign({ id: time })
                  .write();

                res.render("admin/add", {
                  formerEvents: former,
                  upcomingEvents: upcoming,
                  visits: industrial,
                  event: checkEvent,
                  succ: true,
                  err: false
                });
              }
            }

            // For Former Events

            if (checkEvent == "former") {
              let { itemtoMove } = req.body;
              const getUpcoming = upcomingDB
                .get("upcoming")
                .find({ title: itemtoMove })
                .value();

              if (!itemtoMove) {
                res.render("admin/add", {
                  formerEvents: former,
                  upcomingEvents: upcoming,
                  visits: industrial,
                  event: checkEvent,
                  succ: false,
                  err: true
                });
              } else {
                upcomingDB
                  .get("upcoming")
                  .remove({ title: itemtoMove })
                  .write();

                formerDB
                  .get("former")
                  .push(getUpcoming)
                  .write();

                res.render("admin/add", {
                  formerEvents: former,
                  upcomingEvents: upcoming,
                  visits: industrial,
                  event: checkEvent,
                  succ: true,
                  err: false
                });
              }
            }
          }
        );
      });
    });
  });
});

adminRouter.get("/logout", function(req, res) {
  req.session.destroy(() => {
    // console.log("Admin logged out.");
  });
  res.redirect("/login");
});

module.exports = adminRouter;
