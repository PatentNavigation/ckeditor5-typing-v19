/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import ClassicTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/classictesteditor';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import LinkEditing from '@ckeditor/ckeditor5-link/src/linkediting';
import Input from '../../src/input';

import { downcastElementToElement } from '@ckeditor/ckeditor5-engine/src/conversion/downcast-converters';
import { upcastElementToElement } from '@ckeditor/ckeditor5-engine/src/conversion/upcast-converters';

import ViewText from '@ckeditor/ckeditor5-engine/src/view/text';
import ViewElement from '@ckeditor/ckeditor5-engine/src/view/element';
import ViewContainerElement from '@ckeditor/ckeditor5-engine/src/view/containerelement';
import ViewSelection from '@ckeditor/ckeditor5-engine/src/view/selection';
import MutationObserver from '@ckeditor/ckeditor5-engine/src/view/observer/mutationobserver';

import { getData as getModelData, setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { getData as getViewData } from '@ckeditor/ckeditor5-engine/src/dev-utils/view';

/* global document */

// NOTE: In all these tests we need to simulate the mutations. However, it's really tricky to tell what
// should be in "newChildren" because we don't have yet access to these nodes. We pass new instances,
// but this means that DomConverter which is used somewhere internally may return a different instance
// (which wouldn't happen in practice because it'd cache it). Besides, it's really hard to tell if the
// browser will keep the instances of the old elements when modifying the tree when the user is typing
// or if it will create new instances itself too.
// However, the code handling these mutations doesn't really care what's inside new/old children. It
// just needs the mutations common ancestor to understand how big fragment of the tree has changed.
describe( 'Bug ckeditor5-typing#100', () => {
	let domElement, domRoot, editor, model, view, viewRoot;

	beforeEach( () => {
		domElement = document.createElement( 'div' );
		document.body.appendChild( domElement );

		return ClassicTestEditor.create( domElement, { plugins: [ Input, Paragraph, Bold, Italic, LinkEditing ] } )
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
				view = editor.editing.view;
				viewRoot = view.getRoot();
				domRoot = view.getDomRoot();

				// Mock image feature.
				newEditor.model.schema.register( 'image', { allowWhere: '$text' } );

				editor.conversion.for( 'downcast' ).add( downcastElementToElement( {
					model: 'image',
					view: 'img'
				} ) );

				editor.conversion.for( 'upcast' ).add( upcastElementToElement( {
					view: 'img',
					model: 'image'
				} ) );

				// Disable MO completely and in a way it won't be reenabled on some Document#render() call.
				const mutationObserver = view.getObserver( MutationObserver );

				mutationObserver.disable();
				mutationObserver.enable = () => {};
			} );
	} );

	afterEach( () => {
		domElement.remove();

		return editor.destroy();
	} );

	// This happens when browser automatically switches parent and child nodes.
	it( 'should handle mutations switching inner and outer node when adding new text node after', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text italic="true" linkHref="foo">' +
			'text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><a href="foo"><i>text{}</i></a></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const link = paragraph.getChild( 0 );
		const italic = link.getChild( 0 );
		const text = italic.getChild( 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<i><a href="foo">text</a>x</i>';
		view.fire( 'mutations', [
			// First mutation - remove all children from link element.
			{
				type: 'children',
				node: link,
				oldChildren: [ italic ],
				newChildren: []
			},

			// Second mutation - remove link from paragraph and put italic there.
			{
				type: 'children',
				node: paragraph,
				oldChildren: [ link ],
				newChildren: [ new ViewElement( 'i' ) ]
			},

			// Third mutation - italic's new children.
			{
				type: 'children',
				node: italic,
				oldChildren: [ text ],
				newChildren: [ new ViewElement( 'a', null, text.clone() ), new ViewText( 'x' ) ]
			}
		] );

		expect( getViewData( view ) ).to.equal( '<p><a href="foo"><i>textx{}</i></a></p>' );
	} );

	it( 'should handle mutations switching inner and outer node when adding new text node before', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text italic="true" linkHref="foo">' +
			'[]text' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><a href="foo"><i>{}text</i></a></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const link = paragraph.getChild( 0 );
		const italic = link.getChild( 0 );
		const text = italic.getChild( 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<i>x<a href="foo">text</a></i>';
		view.fire( 'mutations', [
			// First mutation - remove all children from link element.
			{
				type: 'children',
				node: link,
				oldChildren: [ italic ],
				newChildren: []
			},

			// Second mutation - remove link from paragraph and put italic there.
			{
				type: 'children',
				node: paragraph,
				oldChildren: [ link ],
				newChildren: [ new ViewElement( 'i' ) ]
			},

			// Third mutation - italic's new children.
			{
				type: 'children',
				node: italic,
				oldChildren: [ text ],
				newChildren: [ new ViewText( 'x' ), new ViewElement( 'a', null, 'text' ) ]
			}
		] );

		expect( getViewData( view ) ).to.equal( '<p><a href="foo"><i>x{}text</i></a></p>' );
	} );

	it( 'should handle mutations switching inner and outer node - with text before', () => {
		setModelData( model,
			'<paragraph>' +
			'xxx<$text italic="true" linkHref="foo">' +
			'text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p>xxx<a href="foo"><i>text{}</i></a></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const textBefore = paragraph.getChild( 0 );
		const link = paragraph.getChild( 1 );
		const italic = link.getChild( 0 );
		const text = italic.getChild( 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = 'xxx<i><a href="foo">text</a>x</i>';
		view.fire( 'mutations', [
			// First mutation - remove all children from link element.
			{
				type: 'children',
				node: link,
				oldChildren: [ italic ],
				newChildren: []
			},

			// Second mutation - remove link from paragraph and put italic there.
			{
				type: 'children',
				node: paragraph,
				oldChildren: [ textBefore, link ],
				newChildren: [ new ViewText( 'xxx' ), new ViewElement( 'i' ) ]
			},

			// Third mutation - italic's new children.
			{
				type: 'children',
				node: italic,
				oldChildren: [ text ],
				newChildren: [ new ViewElement( 'a', null, 'text' ), new ViewText( 'x' ) ]
			}
		] );

		expect( getViewData( view ) ).to.equal( '<p>xxx<a href="foo"><i>textx{}</i></a></p>' );
	} );

	// This happens when spell checker is applied on <strong> element and changes it to <b>.
	it( 'should handle mutations replacing node', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text bold="true">' +
			'text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const strong = paragraph.getChild( 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<b>fixed text</b>';
		view.fire( 'mutations', [
			// Replace `<strong>` with `<b>`.
			{
				type: 'children',
				node: paragraph,
				oldChildren: [ strong ],
				newChildren: [ new ViewElement( 'b', null, 'fixed text' ) ]
			}
		] );

		expect( getViewData( view, { withoutSelection: true } ) ).to.equal( '<p><strong>fixed text</strong></p>' );
	} );

	// Spell checker splits text inside attributes to two text nodes.
	it( 'should handle mutations inside attribute element', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text bold="true">' +
			'this is foo text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><strong>this is foo text{}</strong></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const strong = paragraph.getChild( 0 );
		const text = strong.getChild( 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].childNodes[ 0 ].innerHTML = 'this is bar text';
		view.fire( 'mutations', [
			{
				type: 'children',
				node: strong,
				oldChildren: [ text ],
				newChildren: [ new ViewText( 'this is bar' ), new ViewText( ' text' ) ]
			}
		] );

		expect( getViewData( view, { withoutSelection: true } ) ).to.equal( '<p><strong>this is bar text</strong></p>' );
	} );

	it( 'should do nothing if elements mutated', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text bold="true">' +
			'text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const strong = paragraph.getChild( 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<strong>text</strong><img />';
		view.fire( 'mutations', [
			{
				type: 'children',
				node: paragraph,
				oldChildren: [ strong ],
				newChildren: [
					new ViewElement( 'strong', null, new ViewText( 'text' ) ),
					new ViewElement( 'img' )
				]
			}
		] );

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );
	} );

	it( 'should do nothing if text is not changed', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text bold="true">' +
			'text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const strong = paragraph.getChild( 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<strong>text</strong>';
		view.fire( 'mutations', [
			{
				type: 'children',
				node: paragraph,
				oldChildren: [ strong ],
				newChildren: [ new ViewElement( 'strong', null, new ViewText( 'text' ) ) ]
			}
		] );

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );
	} );

	it( 'should do nothing on empty mutations', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text bold="true">' +
			'text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<strong>text</strong>';
		view.fire( 'mutations', [] );

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );
	} );

	it( 'should do nothing if mutations does not have common ancestor', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text bold="true">' +
			'text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const strong = paragraph.getChild( 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<strong>text</strong>';
		view.fire( 'mutations', [
			{
				type: 'children',
				node: paragraph,
				oldChildren: [ strong ],
				newChildren: [ strong ]
			},
			{
				type: 'children',
				node: new ViewContainerElement( 'div' ),
				oldChildren: [],
				newChildren: [ new ViewText( 'foo' ), new ViewText( 'bar' ) ]
			}
		] );

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );
	} );

	it( 'should handle view selection if one is returned from mutations', () => {
		setModelData( model,
			'<paragraph>' +
			'<$text bold="true">' +
			'text[]' +
			'</$text>' +
			'</paragraph>'
		);

		expect( getViewData( view ) ).to.equal( '<p><strong>text{}</strong></p>' );

		const paragraph = viewRoot.getChild( 0 );
		const strong = paragraph.getChild( 0 );
		const viewSelection = new ViewSelection( paragraph, 0 );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<b>textx</b>';
		view.fire( 'mutations', [
			// Replace `<strong>` with `<b>`.
			{
				type: 'children',
				node: paragraph,
				oldChildren: [ strong ],
				newChildren: [ new ViewElement( 'b', null, new ViewText( 'textx' ) ) ]
			}
		], viewSelection );

		expect( getModelData( model ) ).to.equal( '<paragraph><$text bold="true">[]textx</$text></paragraph>' );
		expect( getViewData( view ) ).to.equal( '<p><strong>{}textx</strong></p>' );
	} );

	// #117.
	it( 'should handle mixed mutations', () => {
		setModelData( model, '<paragraph>[]<$text bold="true">Foo bar aple</$text></paragraph>' );

		const paragraph = viewRoot.getChild( 0 );
		const strong = paragraph.getChild( 0 );
		const viewSelection = new ViewSelection( paragraph );

		// Simulate mutations and DOM change.
		domRoot.childNodes[ 0 ].innerHTML = '<strong>Foo bar </strong><b>apple</b>';
		view.fire( 'mutations', [
			{
				type: 'text',
				oldText: 'Foo bar aple',
				newText: 'Foo bar ',
				node: viewRoot.getChild( 0 ).getChild( 0 )
			},
			{
				type: 'children',
				oldChildren: [ strong ],
				newChildren: [ strong, new ViewElement( 'b', null, new ViewText( 'apple' ) ) ],
				node: paragraph
			}
		], viewSelection );

		expect( getModelData( model ) ).to.equal( '<paragraph><$text bold="true">[]Foo bar apple</$text></paragraph>' );
		expect( getViewData( view ) ).to.equal( '<p><strong>{}Foo bar apple</strong></p>' );
	} );
} );
