/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Command from '../command/command.js';
import Selection from '../engine/model/selection.js';
import ChangeBuffer from './changebuffer.js';
import count from '../utils/count.js';

/**
 * The delete command. Used by the {@link typing.Delete delete feature} to handle the <kbd>Delete</kbd> and
 * <kbd>Backspace</kbd> keys.
 *
 * @member typing
 * @extends ckeditor5.command.Command
 */
export default class DeleteCommand extends Command {
	/**
	 * Creates an instance of the command.
	 *
	 * @param {ckeditor5.Editor} editor
	 * @param {'forward'|'backward'} direction The directionality of the delete describing in what direction it
	 * should consume the content when the selection is collapsed.
	 */
	constructor( editor, direction ) {
		super( editor );

		/**
		 * The directionality of the delete describing in what direction it should
		 * consume the content when the selection is collapsed.
		 *
		 * @readonly
		 * @member {'forward'|'backward'} typing.DeleteCommand#direction
		 */
		this.direction = direction;

		/**
		 * Delete's change buffer used to group subsequent changes into batches.
		 *
		 * @readonly
		 * @private
		 * @member {typing.ChangeBuffer} typing.DeleteCommand#buffer
		 */
		this._buffer = new ChangeBuffer( editor.document, editor.config.get( 'undo.step' ) );
	}

	/**
	 * Executes the delete command. Depending on whether the selection is collapsed or not, deletes its content
	 * or a piece of content in the {@link typing.DeleteCommand#direction defined direction}.
	 *
	 * @param {Object} [options] The command options.
	 * @param {'character'} [options.unit='character'] See {@link engine.model.composer.modifySelection}'s options.
	 */
	_doExecute( options = {} ) {
		const doc = this.editor.document;

		doc.enqueueChanges( () => {
			const selection = Selection.createFromSelection( doc.selection );

			// Try to extend the selection in the specified direction.
			if ( selection.isCollapsed ) {
				doc.composer.modifySelection( selection, { direction: this.direction, unit: options.unit } );
			}

			// If selection is still collapsed, then there's nothing to delete.
			if ( selection.isCollapsed ) {
				return;
			}

			let changeCount = 0;

			selection.getFirstRange().getMinimalFlatRanges().forEach( ( range ) => {
				changeCount += count(
					range.getWalker( { singleCharacters: true, ignoreElementEnd: true, shallow: true } )
				);
			} );

			doc.composer.deleteContents( this._buffer.batch, selection, { merge: true } );
			this._buffer.input( changeCount );

			doc.selection.setRanges( selection.getRanges(), selection.isBackward );
		} );
	}
}
