const neo4j = require('neo4j-driver').v1;
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD));
const session = driver.session();
const fetch = require('node-fetch');
const { getAuthorizationHeader, cherryPickData } = require('./spotify');


const getPath = (artist1, artist2) => {
  return new Promise((resolve, reject) => {
    const resultPromise = session.run(
      `
        MATCH path = shortestPath(
            (a1:Artist {artistId:$artist1})-[:Related*]->(a2:Artist {artistId:$artist2}))
        RETURN path;
      `,
      {artist1, artist2}
    );

    resultPromise.then(result => {
      const singleRecord = result.records[0];
      const node = singleRecord.get(0);
      resolve(node.segments.map((element) => element.start.properties.artistId));
    }).catch(error => {
      console.log(error);
      error(error);
    });
  });
}

exports.default = async (req, res) => {
  const shortestPath = await getPath(req.params.firstArtistId, req.params.secondArtistId);
  const headers = await getAuthorizationHeader();
  const response = await fetch(`https://api.spotify.com/v1/artists?ids=${shortestPath.join()}`, { headers });
  if (response.status === 200) {
    let data = await response.json();
    const cherryPickedData = cherryPickData(data.artists.slice(1, data.artists.length));
    return res.json(cherryPickedData);
  } else {
    return res.status(500).send('something went wrong');
  }
  driver.close();
  session.close();
}

