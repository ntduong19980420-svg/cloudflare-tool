const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

app.post('/api/add-domains', async (req, res) => {
  const { authEmail, globalApiKey, domains, serverIp, jumpStart, delay } = req.body;

  if (!authEmail || !globalApiKey || !domains || domains.length === 0) {
    return res.status(400).json({ error: 'Thiếu API Key, Email hoặc Domain' });
  }

  const headers = {
    'X-Auth-Email': authEmail,
    'X-Auth-Key': globalApiKey,
    'Content-Type': 'application/json'
  };

  const results = [];

  for (const domain of domains) {
    const cleanDomain = domain.trim();
    if (!cleanDomain || cleanDomain.startsWith('#')) continue;

    try {
      const zoneRes = await axios.post(
        'https://api.cloudflare.com/client/v4/zones',
        { name: cleanDomain, jump_start: jumpStart, type: 'full' },
        { headers }
      );

      const zoneId = zoneRes.data.result.id;
      const ns = zoneRes.data.result.name_servers;

      if (serverIp && serverIp.trim() !== '') {
        await axios.post(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
          { type: 'A', name: '@', content: serverIp.trim(), proxied: true },
          { headers }
        );

        await axios.post(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
          { type: 'CNAME', name: 'www', content: cleanDomain, proxied: true },
          { headers }
        );
      }

      results.push({ domain: cleanDomain, status: 'Thành công', nameServers: ns });
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.message;
      results.push({ domain: cleanDomain, status: 'Thất bại', error: msg });
    }

    if (delay) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return res.json({ results });
});

app.listen(3000, () => {
  console.log('Server đang chạy tại http://localhost:3000');
});