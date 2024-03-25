import React, { useState } from 'react';
import Table from "@cloudscape-design/components/table";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import TextFilter from "@cloudscape-design/components/text-filter";
import Header from "@cloudscape-design/components/header";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import Pagination from "@cloudscape-design/components/pagination";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Badge from "@cloudscape-design/components/badge"
import Modal from "@cloudscape-design/components/modal";
import Container from "@cloudscape-design/components/container";
import Alert from "@cloudscape-design/components/alert";

function VoicemailTable(props) {

    const ValueWithLabel = ({ label, children }) => (
        <div>
          <Box variant="awsui-key-label">{label}</Box>
          <div>{children}</div>
        </div>
      );

    const handleTableAction = async (e) => {
        if (e.detail.id === "mr") {
            props.markUnread(false, props.selectedItems[0].contactId)
            props.setSelectedItems([])
            props.handleRefresh()
        }
        if (e.detail.id === "mur") {
            props.markUnread(true, props.selectedItems[0].contactId)
            props.setSelectedItems([])
            props.handleRefresh()
        }
        if (e.detail.id === "dl") {
            alert("Insert download")
        }
        else if (e.detail.id === "del") {
            props.setVisibleDeleteModal(true)
        }
    }

    return (
        <div className="voicemail-table">
            <Table
                onSelectionChange={({ detail }) => {
                    props.setSelectedItems(detail.selectedItems);
                    if (!props.isPlaying) {
                        props.setCurrentSong(detail.selectedItems[0]);
                    }
                }}
                selectedItems={props.selectedItems}
                ariaLabels={{
                    selectionGroupLabel: "Items selection",
                    allItemsSelectionLabel: ({ selectedItems }) =>
                    `${selectedItems.length} ${
                        selectedItems.length === 1 ? "item" : "items"
                    } selected`,
                    itemSelectionLabel: ({ selectedItems }, item) =>
                    item.name
                }}
                sortingDisabled
                columnDefinitions={[
                    {
                    id: "id",
                    header: "Contact ID",
                    cell: item => (
                        <div>
                            {item.unread === true ? <Badge className="newbadge" color="green">NEW</Badge> : ""}
                            <span>{item.contactId}</span>
                        </div>
                        ),
                    sortingField: "name",
                    isRowHeader: true
                    },
                    {
                    id: "phoneNumber",
                    header: "Customer phone number",
                    cell: item => item.customer_phone_number,
                    sortingField: "phoneNumber"
                    },
                    {
                    id: "qname",
                    header: "Queue name",
                    cell: item => item.vmx_queue_name
                    },
                    {
                    id: "date",
                    header: "Date received",
                    cell: item => item.eventTime
                    },
                    {
                        id: "readbyusername",
                        header: "Read by",
                        cell: item => item.read_by_username
                        },
                    {
                    id: "actions",
                    header: "Actions",
                    cell: item => (
                        <Button
                        variant="inline-link"
                        ariaLabel={`Play ${item.contactId}`}
                        onClick={() => {
                            if (props.isPlaying) {
                                console.log("ITEM", item)
                                props.setCurrentSong(item)
                                props.currentSongTime.progress = 0;
                                props.setSelectedItems([item])
                            } else {
                                console.log("ITEM", item)
                                props.setCurrentSong(item)
                                props.setIsPlaying(!props.isPlaying)
                                props.currentSongTime.progress = 0;
                                props.setSelectedItems([item])
                            }
                        }}   
                        >
                        Play
                        </Button>
                        
                    ),
                    minWidth: 170
                    }
                ]}
                columnDisplay={[
                    { id: "id", visible: true },
                    { id: "phoneNumber", visible: true },
                    { id: "qname", visible: true },
                    { id: "date", visible: true },
                    { id: "readbyusername", visible: true },
                    { id: "actions", visible: true }
                ]}
                items={props.filteredVoicemailList}
                loading={props.onload}
                loadingText="Loading"
                selectionType="single"
                stickyColumns={{ first: 0, last: 1 }}
                trackBy="contactId"
                empty={
                    <Box
                    margin={{ vertical: "xs" }}
                    textAlign="center"
                    color="inherit"
                    >
                    <SpaceBetween size="m">
                        <b>You currently have no voicemails.</b>
                        <Button onClick={props.handleRefresh}>Refresh</Button>
                    </SpaceBetween>
                    </Box>
                }
                filter={
                    <TextFilter
                    filteringPlaceholder="Search voicemails"
                    filteringText={props.filteringText}
                    onChange={({ detail }) => {
                        props.setFilteringText(detail.filteringText)
                        if (detail.filteringText) { 
                            const filteredData = props.voicemailList.filter(item => {
                            // Convert all values of the contact object to a string, join     them, convert the string to lowercase and return the contact object if it includes the searchValue
                            return Object.values(item)
                                .join('')
                                .toLowerCase()
                                .includes(detail.filteringText.toLowerCase());
                            });
                            props.setFilteredVoicemailList(filteredData); // Update filteredContacts state with filtered array
                        } else {
                            props.setFilteredVoicemailList(props.voicemailList); // Reset filteredContacts to all contacts when input is empty
                        }
                    }
                }

                    />
            }

                header={
                    <div className='second-table-header'>
                    <Header
                    counter={"(" + props.voicemailList.length + ")"}
                    actions={
                        <SpaceBetween
                        direction="horizontal"
                        size="xs"
                        >
                        <Button iconName="refresh" variant="icon" onClick={props.handleRefresh} />
                        <ButtonDropdown
                            items={
                                props.selectedItems.length  ? 
                                (props.selectedItems[0].unread === true ? 
                                    [
                                    {
                                        text: "Download",
                                        id: "dl",
                                        disabled: false
                                    },
                                    {
                                    text: "Mark as read",
                                    id: "mr",
                                    disabled: false
                                    } ,
                                    {
                                    text: "Delete",
                                    id: "del",
                                    disabled: true
                                    } 
                                     ] 
                                     :  
                                     [
                                        {
                                            text: "Download",
                                            id: "dl",
                                            disabled: false
                                        },
                                        {
                                            text: "Mark as unread",
                                            id: "mur",
                                            disabled: false
                                        },
                                        {
                                            text: "Delete",
                                            id: "del",
                                            disabled: false
                                        } 
                                         ]
                                        )
                                      : 
                                    [
                                    {
                                        text: "Download",
                                        id: "dl",
                                        disabled: true
                                    },
                                    {
                                        text: "Mark as read",
                                        id: "mr",
                                        disabled: true
                                    },
                                    {
                                        text: "Delete",
                                        id: "del",
                                        disabled: true
                                    } 
                                ]
                            }
                            onItemClick={handleTableAction}
                        >
                            Actions
                        </ButtonDropdown>
                        </SpaceBetween>
                    }
                    >Voicemails
                    </Header>
                    </div>
                }
                pagination={
                    <Pagination currentPageIndex={1} pagesCount={1} />
                }
                preferences={
                    <CollectionPreferences
                    title="Preferences"
                    confirmLabel="Confirm"
                    cancelLabel="Cancel"
                    preferences={{
                        pageSize: 10,
                        contentDisplay: [
                        { id: "fileName", visible: true },
                        { id: "phoneNumber", visible: true },
                        { id: "date", visible: true },
                        { id: "actions", visible: true }
                        ]
                    }}
                    pageSizePreference={{
                        title: "Page size",
                        options: [
                        { value: 10, label: "10 resources" },
                        { value: 20, label: "20 resources" }
                        ]
                    }}
                    stickyColumnsPreference={{
                        firstColumns: {
                        title: "Stick first column(s)",
                        description:
                            "Keep the first column(s) visible while horizontally scrolling the table content.",
                        options: [
                            { label: "None", value: 0 },
                            { label: "First column", value: 1 },
                            { label: "First two columns", value: 2 }
                        ]
                        },
                        lastColumns: {
                        title: "Stick last column",
                        description:
                            "Keep the last column visible while horizontally scrolling the table content.",
                        options: [
                            { label: "None", value: 0 },
                            { label: "Last column", value: 1 }
                        ]
                        }
                    }}
                    />
      }
        />
        <Modal
        onDismiss={() => props.setVisibleDeleteModal(false)}
        visible={props.visibleDeleteModal}
        footer={
            <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => props.setVisibleDeleteModal(false)}>Cancel</Button>
                {props.visibleDeleteLoadingButton ? <Button loading variant="primary">Delete</Button> : <Button variant="primary" onClick={() => props.handleDelete(props.selectedItems[0].contactId)}>Delete</Button>}
            </SpaceBetween>
            </Box>
        }
        header="Delete voicemail"
        >
        <SpaceBetween size="l">
        <div>Are you sure you want to delete this voicemail?</div>
        <Alert statusIconAriaLabel="Warning" type="warning">
            You cannot undo this action.
        </Alert>
        <p></p>
        </SpaceBetween>
        <Container header={<Header headingTagOverride="h3">Voicemail details</Header>}>
            <SpaceBetween size="l">
                <ValueWithLabel label="Contact ID">
                    {props.selectedItems.length ? (props.selectedItems[0].contactId ? props.selectedItems[0].contactId : "No voicemail selected") : "No voicemail selected"}
                </ValueWithLabel>
                <ValueWithLabel label="Queue">
                    {props.selectedItems.length ? (props.selectedItems[0].vmx_queue_name ? props.selectedItems[0].vmx_queue_name : "No voicemail selected") : "No voicemail selected"}
                </ValueWithLabel>
                <ValueWithLabel label="Received">
                    {props.selectedItems.length ? (props.selectedItems[0].eventTime ? props.selectedItems[0].eventTime : "No voicemail selected") : "No voicemail selected"}
                </ValueWithLabel>
                <ValueWithLabel label="Read by">
                    {props.selectedItems.length ? (props.selectedItems[0].read_by_username ? props.selectedItems[0].read_by_username : "No voicemail selected") : "No voicemail selected"}
                </ValueWithLabel>
            </SpaceBetween>
        </Container>
         

        </Modal>

        </div>
    )
}


export default VoicemailTable