import React from 'react';
import { renderWithRedux, patientlyWaitFor, fireEvent, act } from 'react-testing-lib-wrapper';
import { Route } from 'react-router-dom';

import ContentViewFilterDetails from '../ContentViewFilterDetails';
import { cvFilterDetailsKey } from '../../../ContentViewsConstants';
import {
  nockInstance,
  assertNockRequest,
  mockAutocomplete,
  mockSetting,
} from '../../../../../test-utils/nockWrapper';
import api from '../../../../../services/api';
import cvFilterDetails from './cvPackageFilterDetail.fixtures.json';
import cvPackageFilterRules from './cvPackageFilterRules.fixtures.json';
import cvFilterFixtures from './contentViewFilters.fixtures.json';
import details from '../../../__tests__/mockDetails.fixtures.json';

const cvFiltersPath = api.getApiUrl('/content_view_filters');
const cvFilterDetailsPath = api.getApiUrl('/content_view_filters/2');
const cvFilterEditDeletePath = api.getApiUrl('/content_view_filters/2/rules/2');
const cvPackageFilterRulesPath = api.getApiUrl('/content_view_filters/2/rules');
const cvPackageFilterRuleCreatePath = api.getApiUrl('/content_view_filters/2/rules');
const autocompleteUrl = '/content_view_filters/2/rules/auto_complete_search';
const autocompleteNameUrl = '/packages/auto_complete_name';
const autocompleteArchUrl = '/packages/auto_complete_arch';
const renderOptions = {
  apiNamespace: cvFilterDetailsKey(1, 2),
  routerParams: {
    initialEntries: [{ pathname: '/content_views/1#/filters/2', hash: '#/filters' }],
    initialIndex: 1,
  },
};

const withCVRoute = component => <Route path="/content_views/:id([0-9]+)#/filters/:filterId([0-9]+)">{component}</Route>;

test('Can show filter details and package groups on page load', async (done) => {
  const { name: cvFilterName } = cvFilterDetails;
  const searchDelayScope = mockSetting(nockInstance, 'autosearch_delay', 0);
  const autoSearchScope = mockSetting(nockInstance, 'autosearch_while_typing');
  const cvFilterScope = nockInstance
    .get(cvFilterDetailsPath)
    .query(true)
    .reply(200, cvFilterDetails);
  const cvFiltersScope = nockInstance
    .get(cvFiltersPath)
    .query(true)
    .reply(200, cvFilterFixtures);
  const cvPackageFilterRulesScope = nockInstance
    .get(cvPackageFilterRulesPath)
    .query(true)
    .reply(200, cvPackageFilterRules);
  const autocompleteScope = mockAutocomplete(nockInstance, autocompleteUrl);

  const { getByText, queryByText } =
    renderWithRedux(withCVRoute(<ContentViewFilterDetails
      cvId={1}
      details={details}
    />), renderOptions);

  // Nothing will show at first, page is loading
  expect(queryByText(cvFilterName)).toBeNull();
  await patientlyWaitFor(() => {
    expect(getByText(cvFilterName)).toBeInTheDocument();
  });

  assertNockRequest(autocompleteScope);
  assertNockRequest(searchDelayScope);
  assertNockRequest(autoSearchScope);
  assertNockRequest(cvFilterScope);
  assertNockRequest(cvFiltersScope);
  assertNockRequest(cvPackageFilterRulesScope, done);
  act(done);
});

test('Can search for package rules in package filter details', async (done) => {
  const firstPackageRule = cvPackageFilterRules.results[0];
  const lastPackageRule = cvPackageFilterRules.results[1];
  const { name: cvFilterName } = cvFilterDetails;
  const { name: firstPackageRuleName } = firstPackageRule;
  const { name: lastPackageRuleName } = lastPackageRule;
  const searchQueryMatcher = actualParams =>
    actualParams?.search?.includes(lastPackageRuleName);
  const searchDelayScope = mockSetting(nockInstance, 'autosearch_delay', 0);
  const autoSearchScope = mockSetting(nockInstance, 'autosearch_while_typing');

  const cvFilterScope = nockInstance
    .get(cvFilterDetailsPath)
    .query(true)
    .reply(200, cvFilterDetails);
  const cvFiltersScope = nockInstance
    .get(cvFiltersPath)
    .query(true)
    .reply(200, cvFilterFixtures);
  const cvPackageFilterRulesScope = nockInstance
    .get(cvPackageFilterRulesPath)
    .query(true)
    .reply(200, cvPackageFilterRules);
  const packageRuleSearchScope = nockInstance
    .get(cvPackageFilterRulesPath)
    .query(searchQueryMatcher)
    .reply(200, { results: [lastPackageRule] });

  const autocompleteScope = mockAutocomplete(nockInstance, autocompleteUrl);
  const withSearchScope = mockAutocomplete(nockInstance, autocompleteUrl, searchQueryMatcher);
  const { getByText, queryByText, getByLabelText } =
    renderWithRedux(withCVRoute(<ContentViewFilterDetails
      cvId={1}
      details={details}
    />), renderOptions);
  // Basic results showing
  await patientlyWaitFor(() => {
    expect(getByText(cvFilterName)).toBeInTheDocument();
    expect(getByText(firstPackageRuleName)).toBeInTheDocument();
  });

  // Search and only searched result shows
  fireEvent.change(getByLabelText(/text input for search/i), { target: { value: lastPackageRuleName } });
  await patientlyWaitFor(() => {
    expect(getByText(lastPackageRuleName)).toBeInTheDocument();
    expect(queryByText(firstPackageRuleName)).not.toBeInTheDocument();
  });

  assertNockRequest(autocompleteScope);
  assertNockRequest(searchDelayScope);
  assertNockRequest(autoSearchScope);
  assertNockRequest(cvFilterScope);
  assertNockRequest(cvFiltersScope);
  assertNockRequest(cvPackageFilterRulesScope);
  assertNockRequest(withSearchScope);
  assertNockRequest(packageRuleSearchScope, done);
});

test('Can add package rules to filter in a self-closing modal', async (done) => {
  const { name: cvFilterName } = cvFilterDetails;
  const autocompleteScope = mockAutocomplete(nockInstance, autocompleteUrl);
  const autocompleteNameScope = mockAutocomplete(nockInstance, autocompleteNameUrl);
  const autocompleteArchScope = mockAutocomplete(nockInstance, autocompleteArchUrl);
  const searchDelayScope = mockSetting(nockInstance, 'autosearch_delay', 0, 3);
  const autoSearchScope = mockSetting(nockInstance, 'autosearch_while_typing', undefined, 3);

  const cvFiltersScope = nockInstance
    .get(cvFiltersPath)
    .query(true)
    .reply(200, cvFilterFixtures);
  const cvFilterDetailsScope = nockInstance
    .get(cvFilterDetailsPath)
    .query(true)
    .reply(200, cvFilterDetails);
  const cvPackageFilterRulesScope = nockInstance
    .get(cvPackageFilterRulesPath)
    .times(2) // One on initial page load and one after rule create
    .query(true)
    .reply(200, cvPackageFilterRules);

  const newFilterRuleDetails = {
    architecture: 'noarch',
    name: 'elephant',
  };

  const createdFilterDetails = {
    architecture: 'noarch',
    content_view_filter_id: 1,
    created_at: '2021-08-06 06:12:10 -0400',
    id: 3,
    name: 'elephant',
    updated_at: '2021-08-06 06:12:10 -0400',
  };

  const createscope = nockInstance
    .post(cvPackageFilterRuleCreatePath, newFilterRuleDetails)
    .reply(201, createdFilterDetails);

  const {
    getByText, queryByText, getByLabelText, getAllByLabelText,
  } =
    renderWithRedux(withCVRoute(<ContentViewFilterDetails
      cvId={1}
      details={details}
    />), renderOptions);

  // Nothing will show at first, page is loading
  expect(queryByText(cvFilterName)).toBeNull();
  await patientlyWaitFor(() => {
    expect(getByText(cvFilterName)).toBeInTheDocument();
    expect(getByLabelText('add_rpm_rule')).toBeInTheDocument();
  });
  getByLabelText('add_rpm_rule').click();
  await patientlyWaitFor(() => {
    expect(getAllByLabelText('text input for search')[1]).toBeInTheDocument();
    expect(getAllByLabelText('text input for search')[2]).toBeInTheDocument();
    expect(getByLabelText('add_package_filter_rule')).toBeInTheDocument();
  });
  fireEvent.change(getAllByLabelText('text input for search')[1], { target: { value: 'elephant' } });
  fireEvent.change(getAllByLabelText('text input for search')[2], { target: { value: 'noarch' } });
  fireEvent.submit(getByLabelText('add_package_filter_rule'));

  await patientlyWaitFor(() => {
    expect(queryByText('Add rule')).not.toBeInTheDocument();
  });
  assertNockRequest(autocompleteScope);
  assertNockRequest(searchDelayScope);
  assertNockRequest(autoSearchScope);
  assertNockRequest(autocompleteNameScope);
  assertNockRequest(autocompleteArchScope);
  assertNockRequest(cvFiltersScope);
  assertNockRequest(cvFilterDetailsScope);
  assertNockRequest(cvPackageFilterRulesScope);
  assertNockRequest(createscope);
  assertNockRequest(cvPackageFilterRulesScope, done);
});

test('Remove rpm filter rule in a self-closing modal', async (done) => {
  const { name: cvFilterName } = cvFilterDetails;
  const autocompleteScope = mockAutocomplete(nockInstance, autocompleteUrl);
  const searchDelayScope = mockSetting(nockInstance, 'autosearch_delay', 0);
  const autoSearchScope = mockSetting(nockInstance, 'autosearch_while_typing');

  const cvFiltersScope = nockInstance
    .get(cvFiltersPath)
    .query(true)
    .reply(200, cvFilterFixtures);
  const cvFilterDetailsScope = nockInstance
    .get(cvFilterDetailsPath)
    .query(true)
    .reply(200, cvFilterDetails);
  const cvPackageFilterRulesScope = nockInstance
    .get(cvPackageFilterRulesPath)
    .times(2) // One on initial page load and one after rule create
    .query(true)
    .reply(200, cvPackageFilterRules);

  const removeScope = nockInstance
    .delete(cvFilterEditDeletePath)
    .reply(201, {});


  const { getByText, queryByText, getAllByLabelText } =
    renderWithRedux(withCVRoute(<ContentViewFilterDetails
      cvId={1}
      details={details}
    />), renderOptions);

  // Nothing will show at first, page is loading
  expect(queryByText(cvFilterName)).toBeNull();
  await patientlyWaitFor(() => {
    expect(getByText(cvFilterName)).toBeInTheDocument();
    expect(getAllByLabelText('Actions')[0]).toBeInTheDocument();
  });

  getAllByLabelText('Actions')[0].click();

  await patientlyWaitFor(() => {
    expect(getByText('Remove')).toBeInTheDocument();
  });

  getByText('Remove').click();

  assertNockRequest(autocompleteScope);
  assertNockRequest(searchDelayScope);
  assertNockRequest(autoSearchScope);
  assertNockRequest(cvFiltersScope);
  assertNockRequest(cvFilterDetailsScope);
  assertNockRequest(cvPackageFilterRulesScope);
  assertNockRequest(removeScope);
  assertNockRequest(cvPackageFilterRulesScope, done);
});

test('Edit rpm filter rule in a self-closing modal', async (done) => {
  const { name: cvFilterName } = cvFilterDetails;
  const autocompleteScope = mockAutocomplete(nockInstance, autocompleteUrl, true, undefined, 2);
  const autocompleteNameScope = mockAutocomplete(nockInstance, autocompleteNameUrl);
  const autocompleteArchScope = mockAutocomplete(nockInstance, autocompleteArchUrl);
  const searchDelayScope = mockSetting(nockInstance, 'autosearch_delay', 0, 3);
  const autoSearchScope = mockSetting(nockInstance, 'autosearch_while_typing', undefined, 3);
  const cvFiltersScope = nockInstance
    .get(cvFiltersPath)
    .times(2)
    .query(true)
    .reply(200, cvFilterFixtures);
  const cvFilterDetailsScope = nockInstance
    .get(cvFilterDetailsPath)
    .times(2)
    .query(true)
    .reply(200, cvFilterDetails);
  const cvPackageFilterRulesScope = nockInstance
    .get(cvPackageFilterRulesPath)
    .times(2) // One on initial page load and one after rule create
    .query(true)
    .reply(200, cvPackageFilterRules);

  const editScope = nockInstance
    .put(cvFilterEditDeletePath)
    .query(true)
    .reply(201, {});

  const {
    getByText, queryByText, getAllByLabelText, getByLabelText,
  } =
    renderWithRedux(withCVRoute(<ContentViewFilterDetails
      cvId={1}
      details={details}
    />), renderOptions);

  // Nothing will show at first, page is loading
  expect(queryByText(cvFilterName)).toBeNull();
  await patientlyWaitFor(() => {
    expect(getByText(cvFilterName)).toBeInTheDocument();
    expect(getAllByLabelText('Actions')[0]).toBeInTheDocument();
  });

  getAllByLabelText('Actions')[0].click();

  await patientlyWaitFor(() => {
    expect(getByText('Edit')).toBeInTheDocument();
  });

  getByText('Edit').click();

  await patientlyWaitFor(() => {
    expect(getByText('Edit RPM rule')).toBeInTheDocument();
    fireEvent.submit(getByLabelText('add_package_filter_rule'));
  });

  await patientlyWaitFor(() => {
    expect(getByText(cvFilterName)).toBeInTheDocument();
  });

  assertNockRequest(autocompleteScope);
  assertNockRequest(searchDelayScope);
  assertNockRequest(autoSearchScope);
  assertNockRequest(autocompleteNameScope);
  assertNockRequest(autocompleteArchScope);
  assertNockRequest(cvFiltersScope);
  assertNockRequest(cvFilterDetailsScope);
  assertNockRequest(cvPackageFilterRulesScope);
  assertNockRequest(editScope, done);
  act(done);
});
