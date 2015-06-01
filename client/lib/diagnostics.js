/**
 * @author Benjamin Berman
 * © 2015 All Rights Reserved
 **/
Diagnostics = {};

Diagnostics.unreferencedRootTemplates = [

];

Diagnostics.templateWhitelist = [
    'body',
    '__body__',
    '__DynamicTemplateError__',
    '__IronDefaultLayout__',
    '__IronRouterNotFound__',
    '__IronRouterNoRoutes__',
    'configureLoginServiceDialogForFacebook',
    'configureLoginServiceDialogForGoogle',
    'configureLoginServiceDialogForLinkedin',
    'loginButtons',
    '_loginButtonsLoggedIn',
    '_loginButtonsLoggedOut',
    '_loginButtonsMessages',
    '_loginButtonsLoggingIn',
    '_loginButtonsLoggingInPadding',
    '_loginButtonsLoggedOutSingleLoginButton',
    '_loginButtonsLoggingInSingleLoginButton',
    '_loginButtonsLoggedInSingleLogoutButton',
    '_loginButtonsLoggedInDropdown',
    '_loginButtonsLoggedInDropdownActions',
    '_loginButtonsLoggedOutDropdown',
    '_loginButtonsLoggedOutAllServices',
    '_loginButtonsLoggedOutPasswordServiceSeparator',
    '_loginButtonsLoggedOutPasswordService',
    '_forgotPasswordForm',
    '_loginButtonsBackToLoginLink',
    '_loginButtonsFormField',
    '_loginButtonsChangePassword',
    '_resetPasswordDialog',
    '_justResetPasswordDialog',
    '_enrollAccountDialog',
    '_justVerifiedEmailDialog',
    '_configureLoginServiceDialog',
    '_loginButtonsMessagesDialog',
    '_configureLoginOnDesktopDialog',
    '__dynamic',
    '__dynamicWithDataContext',
    '__IronRouterProgress__',
    '__IronRouterProgressDefault__',
    'layout',
    'notFound',
    'loading'
];

var parseTemplateFunctionForInvokedTemplates = function (templateName) {
    if (!Template[templateName]) {
        return [];
    }
    return _.map(Template[templateName].renderFunction.toString().match(/lookupTemplate\("(\S+)"\)/g), function (match) {
        return match.slice('lookupTemplate("'.length, match.length - ')"'.length);
    });
};

var referencedTemplates = function (templateName) {
    var references = [];
    var templatesInvoked = parseTemplateFunctionForInvokedTemplates(templateName);

    _.each(templatesInvoked, function (invokedTemplateName) {
        references.push(invokedTemplateName);
        references = references.concat(referencedTemplates(invokedTemplateName));
    });

    return references;
};

var getRootTemplates = function () {
    return Diagnostics.getRouteTemplates().concat(Diagnostics.templateWhitelist).concat(Diagnostics.unreferencedRootTemplates);
};

var getAllTemplates = function () {
    return _.filter(_.keys(Template), function (key) {
        return Template[key] instanceof Blaze.Template;
    });
};

var getTemplatesInUse = function () {
    // Iterate through all the routes and inspect the tree (directed acyclic graph) of templates they invoke
    return _.uniq(_.flatten(_.map(getRootTemplates(), referencedTemplates)));
};

Diagnostics.getRouteTemplates = function () {
    return _.uniq(_.flatten(_.map(Router.routes, function (route) {
        return _.uniq(_.compact(_.flatten([
            route.options.template || route.getName(),
            route.options.layoutTemplate,
            route.options.yieldTemplates && _.keys(route.options.yieldTemplates)
        ])))
    })));
};

Diagnostics.unusedTemplates = function () {
    var templates = getAllTemplates();
    // Root templates are like whitelisted templates and templates used in routes
    var rootTemplates = getRootTemplates();
    // Get all the templates used by the site
    var usedTemplates = getTemplatesInUse();
    // Get all the unused templates
    // If the template is missing from the D.A.G. of routes, it will show up in this difference
    return _.difference(_.difference(templates, usedTemplates), rootTemplates);
};

Diagnostics.viewFor = function (cssSelectorOrElement) {
    cssSelectorOrElement = _.isString(cssSelectorOrElement) ? document.querySelector(cssSelectorOrElement) : cssSelectorOrElement;
    var view = Blaze.getView(cssSelectorOrElement);
    while (!view.template) {
        view = view.parentView;
    }
    return view;
};

if (Meteor.settings.public.diagnostics
    && Meteor.settings.public.diagnostics.enabled === true) {
    Meteor.startup(function () {
        var unusedTemplates = Diagnostics.unusedTemplates();
        if (unusedTemplates.length > 0) {
            console.error('DEAD TEMPLATES DETECTED:', unusedTemplates);
            console.error('If you added a modal, make sure to add it to the array Diagnostics.unreferencedRootTemplates in diagnostics.js\nOtherwise, please clean up your dead code.');
        }
    });
}
