const https = require("https");

function fetchUrl(url) {
  https
    .get(url, (res) => {
      // Handle Redirects (302)
      if (res.statusCode === 302 && res.headers.location) {
        console.log("Redirecting to:", res.headers.location);
        fetchUrl(res.headers.location);
        return;
      }

      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.data) {
            const dadan = json.data.find((v) => {
              // Check all keys for "Dadan"
              return Object.values(v).some((val) =>
                String(val).includes("Dadan"),
              );
            });

            if (dadan) {
              console.log(JSON.stringify(dadan, null, 2));
            } else {
              console.log("Vendor Dadan not found.");
              // Log first item to see structure
              if (json.data.length > 0) {
                console.log(
                  "First vendor structure:",
                  JSON.stringify(json.data[0], null, 2),
                );
              }
            }
          } else {
            console.log("No data found in response:", data);
          }
        } catch (e) {
          console.error("JSON Error: " + e.message);
          console.log("Raw data sample:", data.substring(0, 200));
        }
      });
    })
    .on("error", (err) => {
      console.log("Error: " + err.message);
    });
}

const url =
  "https://script.google.com/macros/s/AKfycbzjUzC_A6HWi8wsjpqlYWbc5rE7uQBrq7EDYkrSZDZPZmDZYkt4udGyzFOAT7DUUoQx1Q/exec?sheet=VENDOR&action=read";

fetchUrl(url);
