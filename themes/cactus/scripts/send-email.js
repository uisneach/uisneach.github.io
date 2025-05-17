/*const hexo = require('hexo');
const nodemailer = require('nodemailer');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const emailConfigPath = path.join(__dirname, 'source/_data/data.yml');
const siteUrl = hexo.config.url || 'uisneac.com';

const sendEmail = async (post) => {
  const emailConfig = yaml.load(fs.readFileSync(emailConfigPath, 'utf8'));
  const emailList = emailConfig.emails;

  // Configure your SMTP settings here
  let transporter = nodemailer.createTransport({
    service: 'protonmail',
    auth: {
      user: 'grandsonoffinn@protonmail.com'
      pass: 'eringobragh26632'
    }
  });

  const postUrl = `${siteUrl}${post.path}`;
  const mailOptions = {
    from: 'grandsonoffinn@protonmail.com',
    to: emailList.join(', '),
    subject: `Article: ${post.title}`,
    text: `This is a text email:\n\nTitle: ${post.title}\n\nURL: ${postUrl}\n\nContent:\n${post.content}`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Emails sent successfully');
  } catch (error) {
    console.error('Error sending emails:', error);
  }
};

module.exports = sendEmail;
*/