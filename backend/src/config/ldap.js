const ActiveDirectory = require("activedirectory2");
const env = require("./env");

const config = {
  url: env.LDAP_URL,
  baseDN: env.LDAP_BASE_DN,
  username: env.LDAP_USER,
  password: env.LDAP_PASS,
  referral: false,

  attributes: {
    user: [
      "givenName", "initials", "sn", "displayName", "description",
      "physicalDeliveryOfficeName", "telephoneNumber", "mail", "wWWHomePage",
      "streetAddress", "postOfficeBox", "l", "st", "postalCode", "co",
      "userPrincipalName", "sAMAccountName", "profilePath", "scriptPath",
      "homeDirectory", "homeDrive", "homePhone", "pager", "mobile",
      "facsimileTelephoneNumber", "ipPhone", "title", "department",
      "company", "manager", "directReports", "distinguishedName",
      "objectClass", "objectCategory", "memberOf", "userAccountControl", "whenCreated",
    ],
  },
};

const ad = new ActiveDirectory(config);

module.exports = ad;
