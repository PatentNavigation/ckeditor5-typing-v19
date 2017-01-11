/**
 * @license Copyright (c) 2003-2017, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Typing from 'ckeditor5-typing/src/typing';
import Input from 'ckeditor5-typing/src/input';
import Delete from 'ckeditor5-typing/src/delete';

describe( 'Typing feature', () => {
	it( 'requires Input and Delete features', () => {
		const typingRequirements = Typing.requires;

		expect( typingRequirements ).to.contain( Input );
		expect( typingRequirements ).to.contain( Delete );
	} );
} );
