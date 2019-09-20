const execa = require("execa");
const path = require("path");
const KUBECTL_PATH = path.join(__dirname, "kubectl");

const mongoose = require("mongoose");
const authenticate = require("mm-authenticate")(mongoose);
const { Script, Team } = require("mm-schemas")(mongoose);
const { send, buffer } = require("micro");

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);
mongoose.Promise = global.Promise;

module.exports = authenticate(async (req, res) => {
  if (!req.user.admin) {
    send(res, 401, "Error: user does not have admin priveleges.");
    return;
  }

  console.log("Grabbing all teams...");
  const allTeams = await Team.find().populate("latestScript").populate("mostRecentPush").exec();

  console.log("Grabbing all scripts...");
  const allScripts = await Script.find().exec();

  if (allTeams.length == 0) {
    send(res, 200, "Error: there are no teams to remove games!");
    return;
  }

  if (allScripts.length == 0) {
    send(res, 200, "Error: there are no bots to clear!");
    return;
  }

  // Remove IP address from old script, then only query scripts with IP addresses and by latest script

  console.log("Getting latest scripts of all teams...");
  const currentVersions = allTeams.filter(team => { 
    console.log(`team ${team}`);
    return !!team.latestScript && !!team.mostRecentPush;
  }).map(team => {
    return team.latestScript.key.toString();
  });

  console.log(currentVersions);

  const tenMinutes = new Date(1970, 01, 01, 00, 10)

  console.log("Filtering out scripts without IP addresses... and are at least 10 minutes old");
  const currentScripts = allScripts.filter(script => {
    console.log(`script ${script}`);
    const createdDate = new Date(script.createdAt);
    const nowDate = new Date();

    return !!script.ip && nowDate - createdDate >= tenMinutes;
  }).map(script => {
    return script.toString();
  })

  console.log(currentScripts);

  allScripts.forEach(async (script) => {
    const scriptKey = script.key.toString();

    if (!currentVersions.includes(scriptKey)) {
      console.log(`Removing old deployment for ${scriptKey}`);
      
      if (!!script.ip) {
        console.log(`\nRemoving ${script.ip} ip from script ${script}\n`);
        script.ip = undefined;
        await script.save();
      }

      const killDepProc = await execa(KUBECTL_PATH, 
        [  
          "delete", 
          "deployment",
          "-l",
          `bot=${scriptKey}`
        ]);

      console.log(killDepProc.stdout);
      console.warn(killDepProc.stderr);

      console.log(`Removing old service for ${scriptKey}`);

      const killServProc = await execa(KUBECTL_PATH, 
        [  
          "delete", 
          "service",
          "-l",
          `bot=${scriptKey}`
        ]);

      console.log(killServProc.stdout);
      console.warn(killServProc.stderr);
    } else {
      console.log(`Script ${scriptKey} is a current version or younger than 10 minutes; do not destroy.`);
    }
  });

  send(res, 200, "All old versions removed!");
});