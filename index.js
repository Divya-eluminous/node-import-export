const express = require('express');
const { MongoClient } = require('mongodb');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 4000;

const uri = 'mongodb://localhost:27017'; // MongoDB connection URI
const client = new MongoClient(uri);
const path = require('path'); // Import the path module
var cron = require('node-cron');
var nodemailer = require('nodemailer');
var multer = require('multer');
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true}));
app.use(bodyParser.json());

//To export database 
app.get('/export/:dbName', async (req, res) => {
  const dbName = req.params.dbName;  
  try {
    await client.connect();
    const database = client.db(dbName);
    
    const collections = await database.listCollections().toArray();
    const exportedData = {};
    
    for (const collection of collections) {
      const collectionName = collection.name;
      const collectionData = await database.collection(collectionName).find({}).toArray();
      exportedData[collectionName] = collectionData;
    }
    const exportFolder = './exports'; // Change this path as needed.
    const exportPath = `${exportFolder}/${dbName}_export.json`;
    fs.writeFileSync(exportPath, JSON.stringify(exportedData, null, 2));    
    res.json({ message: 'Data exported successfully', exportPath });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'An error occurred' });
  } finally {
    await client.close();
  }
});


//Copy database to other database
app.post('/import/:sourceDB/:targetDB', async (req, res) => {
  const sourceDBName = req.params.sourceDB;
  const targetDBName = req.params.targetDB;

  try {
    await client.connect();
    const sourceDB = client.db(sourceDBName);
    const targetDB = client.db(targetDBName);

    const collections = await sourceDB.listCollections().toArray();
    const importedCollections = [];

    for (const collection of collections) {
      const collectionName = collection.name;

      const collectionData = await sourceDB.collection(collectionName).find({}).toArray();
      const targetCollection = targetDB.collection(collectionName);

      if (collectionData && collectionData.length > 0) {
        await targetCollection.insertMany(collectionData);
        importedCollections.push(collectionName);
        console.log(`Data imported for collection: ${collectionName}`);
      } else {
        console.log(`No data found for collection: ${collectionName}`);
      }
    }

    res.json({ message: 'Data imported successfully', importedCollections });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: 'An error occurred' });
  } finally {
    await client.close();
  }
});

//Import database
app.post('/import/:dbName', async (req, res) => {
  const dbName = req.params.dbName;
   const fileName = req.body.fileName;
  try {
    await client.connect();
    const database = client.db(dbName);

    // const filePath = 'billingModel_export.json'; // Path to the exported JSON file
    // const filePath = fileName;
    const fileData = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(fileData);

    for (const collectionName in jsonData) {   
      if (jsonData.hasOwnProperty(collectionName)) {
        const collectionData = jsonData[collectionName];
        if (Array.isArray(collectionData) && collectionData.length > 0) {
          const collection = database.collection(collectionName);
          await collection.insertMany(collectionData, { ordered: false });
        } else {
          console.log(`No data found for collection: ${collectionName}`);
        }
      }      
    }//for

    res.json({ message: 'Database imported successfully' });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: 'An error occurred' });
  } finally {
    await client.close();
  }
});

//Delete all collections
app.get('/delete/:dbName', async (req, res) => {

  try {
    await client.connect();
    const dbName = req.params.dbName;
    const database = client.db(dbName);
    const collections = await database.listCollections().toArray();
    const collectionNames = collections.map(collection => collection.name);

    for (const collectionName of collectionNames) {
      await database.collection(collectionName).drop();
      console.log(`Dropped collection: ${collectionName}`);
    }
    console.log('All collections dropped successfully.');
    res.json({ message: 'Database collections dropped successfully' });
  } catch (error) {
    console.error('Error dropping collections:', error);
    res.status(500).json({ error: 'An error occurred' });
  } finally {
    await client.close();
  }
});


cron.schedule('* */15 * * *',()=>
{
  //cron.schedule('*/15 * * * *',()=>{
    // Create a transporter object using the default SMTP transport
    const transporter = nodemailer.createTransport({
      service: 'Gmail', // e.g., 'Gmail'
      auth: {
        user: 'eluminous.se64@gmail.com',
        pass: 'cucwifkkbxtxarju',
      }
    });

    const mailOptions = {
      from: 'eluminous.se64@gmail.com',
      to: 'eluminous.se64@gmail.com',
      subject: 'Testing Email',
      text: 'This is a cron job email.'
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });

}, { scheduled: true, timezone: 'Asia/Kolkata' });



const DIR = "./uploads/";
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
     cb(null, DIR);
   },
   filename: (req, file, cb) => {
     cb(null, file.originalname);
   },
 });

let upload = multer({
    storage: storage,
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(json)$/)) {
            return cb(new Error('Please select file with json format'));
        }
        cb(undefined, true);
    },
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

app.post('/importF/:dbName', upload.single('image'),async (req, res) => {
  const dbName = req.params.dbName;
  const inputFile = req.file.filename;
  console.log(inputFile);   

  try {
    await client.connect();
    const database = client.db(dbName);

    //const filePath = 'local_dotwork_export.json'; // Path to the exported JSON file
    const fileData = fs.readFileSync(inputFile, 'utf-8');
    const jsonData = JSON.parse(fileData);

    for (const collectionName in jsonData) {   
      if (jsonData.hasOwnProperty(collectionName)) {
        console.log(collectionName);
        const collectionData = jsonData[collectionName];
        if (Array.isArray(collectionData) && collectionData.length > 0) {
          const collection = database.collection(collectionName);
          await collection.insertMany(collectionData, { ordered: false });
        } else {
          console.log(`No data found for collection: ${collectionName}`);
        }
      }      
    }//for

    /*const batchSize = 100; // Define the batch size based on your needs
    for (const collectionName in jsonData) {
     if (jsonData.hasOwnProperty(collectionName)) {
       console.log(`Processing collection: ${collectionName}`);
       const collectionData = jsonData[collectionName];
       console.log(`Total records to insert: ${collectionData.length}`);
       
       if (Array.isArray(collectionData) && collectionData.length > 0) {
         try {
           const collection = database.collection(collectionName);
           let insertedCount = 0;
             try
             {
               for (let i = 0; i < collectionData.length; i += batchSize) {
                 const batch = collectionData.slice(i, i + batchSize);
                 const result = await collection.insertMany(batch);
                 insertedCount += result.insertedCount;            
                 console.log(`Inserted ${insertedCount} out of ${collectionData.length} records into collection: ${collectionName}`);
               }
               console.log(`Imported data into collection: ${collectionName}`);
               res.status(500).json({ success: `Imported data into collection: ${collectionName}` });
 
             }
             catch(e){
               console.error(`Error importing data into collection ${collectionName}:`, e);
               res.status(500).json({ error: `Error importing data into collection ${collectionName}:` });
             }          
           
         } catch (e) {
           console.error(`Error importing data into collection ${collectionName}:`, e);
           res.status(500).json({ error: `Error importing data into collection ${collectionName}:` });
         }
       } else {
         console.log(`No data found for collection: ${collectionName}`);
         res.status(500).json({ error: `No data found for collection: ${collectionName}` });
       }
     }      
   }*/
    

   console.log('Database imported successfully');
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: 'An error occurred' });
  } finally {
    await client.close();
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
