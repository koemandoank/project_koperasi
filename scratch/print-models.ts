import * as fs from "fs"

function main() {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8")
  const lines = schema.split("\n")
  const models: string[] = []
  for (const line of lines) {
    const match = line.match(/^model\s+(\w+)\s+\{/)
    if (match) {
      models.push(match[1])
    }
  }
  console.log("ALL MODELS IN SCHEMA:")
  console.log(models.join(", "))
}

main()
