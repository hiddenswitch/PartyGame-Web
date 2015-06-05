PartyGameNpm = {};

PartyGameNpm.require = function (name) {
    try {
        return Npm.require(name);
    } catch (e) {
        console.error(e);
        return null;
    }
};