// probe-sqlite-better.cjs
import Database from 'better-sqlite3';
import fs from 'fs';
import sexp from 'sexpression';

function probeDatabase(dbPath) {
    if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file not found: ${dbPath}`);
    }
    const db = new Database(dbPath);

    // {"source": "b7821617-92e6-4708-a59d-e5a8d112e692",
    //  "dest": "//mail.google.com/mail/u/0/#inbox/",  //
    //  "type": "https",
    //  "outline": "Heading1/Subheading2"}
    const edge_data = db
          .prepare(`SELECT source, dest, type, properties FROM links;`)
          .all()
          .map(row => {
        return({
            source: JSON.parse(row.source),
            dest: JSON.parse(row.dest),
            type: JSON.parse(row.type),
            outline: (() => {
                let res = sexp.parse(row.properties.replaceAll(/\\"/g, "'")).outline;
                if (res){res = res.join("/")}
                return(res);
            })()
        })
    });


    // {"id": "438f0aa9-c99f-46cd-a26a-ab68016330a6",
    //  "title": "doc_title",
    //  "heading": "Subheading3",
    //  "tags": ["one", "@two"]
    const node_data = db
          .prepare(`SELECT properties from nodes;`)
          .all()
          .map(row => {
        const das = sexp.parse(row.properties
              .replaceAll(/\\"/g, "'")
              .replaceAll('#(','('));
        const res = Object.fromEntries(new Map(das.map(x => [x.car, x.cdr])));
        // // CATEGORY, ID, BLOCKED, FILE, PRIORITY, ITEM
        let tags = null
        if ("ALLTAGS" in res){
            tags = res["ALLTAGS"][0].split(":")
          .filter(x => x !== "")
          .filter(x => x !== "ATTACH")
        }
        return({
            id : res["ID"],
            title : res["CATEGORY"],
            heading : res["ITEM"] || null,
            tags : tags
        })
    })

    db.close();
    
    return({node_data, edge_data})
}

const dbPath = process.argv[2]
const info = probeDatabase(dbPath);