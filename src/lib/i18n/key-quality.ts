/**
 * Frozen compatibility inventory for keys that predate the semantic-key gate.
 * This list may only shrink: a removed catalog key must be removed here too,
 * and a newly introduced violation fails the audit.
 */
export const FROZEN_LEGACY_KEY_BASELINE = Object.freeze([
  'app.communityNavigation', 'app.communityMobileNavigation', 'app.communityEditorial', 'app.assetCapabilityContractUnavailable',
  'app.shareExpired', 'app.shareRevoked', 'app.shareUnavailable', 'app.shareNotFound', 'app.shareLinks', 'app.shareLink',
  'app.boardTitle', 'app.boardMissingDeleted', 'app.boardName', 'app.boardTitleAllItsShareLinksWillBeDeletedCannotBeUndone', 'app.boardOwnerRevokedShareLink', 'app.boardNowPrivate', 'app.boardSwitchedPrivateShareLinkNoLongerWorks', 'app.boardHasNoLooksYet',
  'app.rights', 'app.pendingCopyrightContentNeverEntersPublicHomeSearchRecommendationsClearFilterSeePublishedLooks', 'app.unavailableNoDesignversionidEditordocSha256', 'app.unavailableNoPreviewRevisionSha256',
  'app.linkContainsConditionsCannotBeAppliedWithoutWideningCurrentFiltersNeverAutoCleared', 'app.incompatibleConditionsListedAboveOnlyExplicitlyRemovingThemCanRevealResultsNeverAutoClearedWidened',
  'app.everyCandidateFailedPublicPublicationPermissionGateFilterScopeNeverWidenedAutomatically', 'app.feedDoesNotLoadThreeJsPreviewManufacturableMadeRequiresVerifiedRealResultFulfillmentRecordUnavailableDemoCreatorsVisibleIntegrationOnly',
  'app.merchandisingConfigurationFailedLoadValidateTrendingPersonalizedRecommendationsStudioOfficialTemplatesNeverSubstitutedFullDiscoveryFeedRemainsAvailableBelow', 'app.bannerFeaturedLooksCollectionsEditorialReasonsNotYetOwnerApprovedNoTrendingPersonalizedResultFabricatedUseFiveBrowseEntriesBelowExploreAllPublicContent',
  'app.saveAddsLookAsReferenceNailBoardLegacyLooksUnversionedInspirationReferencesMadeUnavailableContentHasNoVerifiedRealresultFulfillmentRecord', 'app.noTrendingSignalDataAvailableStaticFixturesCarryNoRealAnalyticsFellBackFeatured',
  'app.insufficientTrendingSignalsAtLeastTrendingfallbackMindistinctsamplesDistinctSamplesWindowRequiredFellBackFeatured', 'app.lookComesLegacyStaticContentNoDesignversionidItCanOnlyBeSavedAsUnversionedInspirationReferenceNeverClaimedVersionStableManufacturable',
  'app.oncePublicAnyoneLinkCanViewBoardReadOnlyNeverEditAnonymouslyPublicContentMayBeIndexedShareLinksStayReadableContinue', 'app.onlyOwnerBoardOwneridentityidCanManageBoardCurrentLocalDemoIdentityLocalDemoIdentityId',
  'app.privateBoardsNeverAnonymouslyShareableSwitchUnlistedPublicShareReadOnly', 'app.shareLinkDoesNotExistWasRemoved', 'app.shareLinkHasExpiredAskBoardOwnerShareAgain',
  'app.legacyStaticContentPartialEvidenceNotFullPublishedlookv1', 'app.sourceStaticFixtureDataNotLiveCommunityBackendDemoCreatorContentVisibleOnlyDevelopmentIntegrationPreviewVerifiedManufacturableProductionDispatchedRecordCarriesNoManufacturingDeviceEvidence',
  'app.createLooksFixedDesignversionPublishPackagePrivateUnlistedOnlyPublicRequiresGovernance', 'editor.tagsCommaSeparatedMax12', 'editor.freeFormTagsSearchCopyOnlyNotAuthoritativeDiscoveryTagsCompleteStructuredDiscoveryFieldsBelow',
  'app.publicReviewBoundExactContentRevisionCompleteSourceCopyrightDeclarationsNext', 'app.structuredDiscoveryMetadataTaxonomyV2', 'app.loadingTaxonomyV2',
  'auth.pendingByDefaultPickExplicitRightsStatusBeforePublishingPendingNeverPublic', 'app.classificationRecordsIntentOnlyPrototypeCarriesNoCapabilityAssetEvidenceChainDoesNotClaimPhysicalManufacturability',
  'community.localOperatorPrototypeExplicitPublicReviewEnforcementStatesNoClaimedSla', 'app.v6CanonicalDocumentPreviewNailLayersLengthLayersPreviewVisibleelementcountVisibleElements',
  'app.studioSavesV6DocumentFirstOnlySuccessfulSaveCanConfirmFreezeVersionCreateNewVersionLaterEdits',
  'app.creators2', 'app.results2', 'app.save2', 'app.delete2', 'app.length2', 'app.clear2', 'app.import2', 'app.draw2', 'app.relief2', 'app.back2', 'app.all10', 'app.layers2',
  'community.taxonomyLoadFailedNoLegacyInference', 'community.discoveryMetadataMissingNoLegacyInference', 'share.switchedPrivateValueRevokedsharecountShareLinkSWereRevoked', 'app.deleteBoard2', 'app.loadingBoards2', 'app.createBoard2', 'app.rightsSingleSelect', 'app.3SelectNailBelowThenChooseCurrentAll10',
  'app.inspirationOnlyPreviewManufacturableUploadNotEnabled', 'app.linkContainsConditionsCannotBeAppliedSoNothingShown', 'app.selectedRightsStatusNeverAppearsPublicContent', 'app.draftsUnpublishedContentNeverAppearExplore',
  'app.separateProductSurfaceNeverCopiedHere', 'app.noBannerConfiguredEditionNoPlaceholderAdSubstituted', 'app.lookCurrentlyUnavailableOpenDetailsDiagnostics', 'app.personalUseOnlyNoUseRemixAction',
  'app.madeRequiresVerifiedRealresultFulfillmentRecordNoEvidenceAvailable', 'app.localStorageCorruptedWritesDisabledClearLocalDataRetry', 'app.lookWasAlreadyBoardNothingDuplicated', 'app.everyBoardAlreadyContainsLookCanCreateNewOne',
  'app.askDesignerNewFixedVersionLink', 'app.fixedPreviewFailedIntegrityValidationWasBlocked', 'app.localStorageCorruptedWritesDisabledAvoidOverwritingIt', 'app.invalidDeepLinkLocalDataWasCleared',
  'app.shownOnceOnlyRawTokenNeverStored', 'app.copyFailedSelectLinkCopyItManually', 'app.readOnlySharedViewAnonymousVisitorsCannotEditBoard', 'app.collectNailLooksIntoVisualBoardsBeginEveryDesignInspiration',
  'app.localStorageCorruptedWritesDisabledAvoidOverwritingItClearBrowserLocalDataRetry', 'app.saveLooksLoveDiscoverTheirImagesWillAppearHereAutomatically', 'app.usingLocalDemoIdentityLocalDemoIdentityIdBoardsStoreLookReferencesOnlyLiveBrowser',
  'app.privateByDefaultCanChangeVisibilityInsideBoardLater', 'app.legacyApplicationLabelCompatibilityEvidenceOnly', 'app.unverifiedNoCopyrightSourceModerationEvidence', 'app.publicationServiceUnavailableExistingDataWasNotOverwritten',
  'app.iHaveRightPublishReferenceContent', 'app.lookNameEnLookIdAsKeyofTypeofRecipeByLookApplied', 'app.shapeLengthSurfaceApplySetColorFollowsEditScopeBelow', 'app.saveFailedDesignWasNotConfirmed',
  'app.designSummaryMissingConfirmationWasNotChanged', 'app.dragCanvasUseArrowKeysPreciseMovement', 'app.drawRecipesLayersAffectNailOnly', 'app.editsSharedDesignOverridesStayIndependent',
  'app.dragLeftCenterRightPinkHandlesNail', 'app.selectCanvasElementEditItsPositionScaleRotationFingerPlacement', 'app.previewExportFailedMakeSureCanvasLoaded', 'app.simulatedPreviewManufacturingUnverifiedNotProductionCommand',
  'app.taxonomyV2FailedLoadStructuredAuthoringDisabledNoFallbackVocabulary', 'app.discoveryUnavailableTaxonomyV2DidNotLoadPublishFlowCannotContinue',
] as const);

/** This ceiling is frozen at migration time. It may decrease, never increase. */
export const FROZEN_LEGACY_KEY_BASELINE_MAX = 111;
