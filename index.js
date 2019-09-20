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
  const team = req.user;
  
  console.log(`${team.name} - Getting the runtime logs from kubectl`);

  const script = (req.url === "/") ? await Script.findbyId(team.latestScript).exec() : req.url.slice(1);

  const kubectlProc = await execa(KUBECTL_PATH, 
    [
      "logs",
      `pods/bot-${script.key}`,
      "--tail=1000"
    ]);

  console.error(kubectlProc.stderr);

  send(res, 200, kubectlProc.stdout);
});