const fs = require('fs');
const filePath = 'src/client/utils/yamlCompiler.ts';
let code = fs.readFileSync(filePath, 'utf-8');

code = code.replace("rulesToExport.push(|", "rulesToExport.push({");
code = code.replace("constitions: ruleData.conditions,", "conditions: ruleData.conditions,");
code = code.replace(".}", "}");

fs.writeFileSync(filePath, code);
